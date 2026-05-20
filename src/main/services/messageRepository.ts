import { createRequire } from 'node:module'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

import type { ChatMessage } from '../../shared/types'

const require = createRequire(import.meta.url)

type StoredMessageRow = {
  message_id: string
  timestamp: string
  channel_name: string
  character_id: string
  sender_name: string
  message_text: string
  message_type: string
  session_file_path: string
  translation_status: string
  translated_text: string | null
  error_message: string | null
}

const PRESERVED_TRANSLATION_STATUSES = new Set(['queued', 'translating', 'translated', 'error'])

export class MessageRepository {
  private sqlite: SqlJsStatic | null = null
  private database: Database | null = null

  constructor(private readonly filePath: string, private readonly maxMessages = 500) {}

  async load(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })

    if (!this.sqlite) {
      this.sqlite = await initSqlJs({
        locateFile: (fileName: string) => require.resolve(`sql.js/dist/${fileName}`)
      })
    }

    const fileExists = await stat(this.filePath)
      .then(() => true)
      .catch(() => false)

    if (fileExists) {
      const raw = await readFile(this.filePath)
      this.database = new this.sqlite.Database(new Uint8Array(raw))
    } else {
      this.database = new this.sqlite.Database()
    }

    this.initializeSchema()
    await this.migrateLegacyJsonIfPresent()
    await this.pruneOldMessages()
    await this.persist()
  }

  getRecentMessages(characterId: string | null, limit = 200): ChatMessage[] {
    const database = this.getDatabase()
    const statement = characterId
      ? database.prepare(`
          SELECT *
          FROM chat_messages
          WHERE character_id = $characterId
          ORDER BY timestamp DESC
          LIMIT $limit
        `)
      : database.prepare(`
          SELECT *
          FROM chat_messages
          ORDER BY timestamp DESC
          LIMIT $limit
        `)

    if (characterId) {
      statement.bind({
        $characterId: characterId,
        $limit: limit
      })
    } else {
      statement.bind({ $limit: limit })
    }

    const messages: ChatMessage[] = []

    while (statement.step()) {
      messages.push(this.mapRowToMessage(statement.getAsObject() as StoredMessageRow))
    }

    statement.free()

    return messages.reverse()
  }

  async upsertMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
    if (messages.length === 0) {
      return []
    }

    const database = this.getDatabase()
    const persistedMessages: ChatMessage[] = []

    database.exec('BEGIN TRANSACTION')

    try {
      const existingStatement = database.prepare('SELECT * FROM chat_messages WHERE message_id = $messageId')
      const upsertStatement = database.prepare(`
        INSERT INTO chat_messages (
          message_id,
          timestamp,
          channel_name,
          character_id,
          sender_name,
          message_text,
          message_type,
          session_file_path,
          translation_status,
          translated_text,
          error_message,
          updated_at
        ) VALUES (
          $messageId,
          $timestamp,
          $channelName,
          $characterId,
          $senderName,
          $messageText,
          $messageType,
          $sessionFilePath,
          $translationStatus,
          $translatedText,
          $errorMessage,
          $updatedAt
        )
        ON CONFLICT(message_id) DO UPDATE SET
          timestamp = excluded.timestamp,
          channel_name = excluded.channel_name,
          character_id = excluded.character_id,
          sender_name = excluded.sender_name,
          message_text = excluded.message_text,
          message_type = excluded.message_type,
          session_file_path = excluded.session_file_path,
          translation_status = excluded.translation_status,
          translated_text = excluded.translated_text,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
      `)

      for (const message of messages) {
        existingStatement.bind({ $messageId: message.messageId })
        const existingMessage = existingStatement.step()
          ? this.mapRowToMessage(existingStatement.getAsObject() as StoredMessageRow)
          : null
        existingStatement.reset()

        const mergedMessage = this.mergeMessage(existingMessage, message)
        persistedMessages.push(mergedMessage)
        upsertStatement.run(this.toStatementParams(mergedMessage))
        upsertStatement.reset()
      }

      existingStatement.free()
      upsertStatement.free()
      await this.pruneOldMessages()
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }

    await this.persist()
    return persistedMessages
  }

  async updateMessage(messageId: string, update: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const database = this.getDatabase()
    const existingMessage = this.findMessage(messageId)

    if (!existingMessage) {
      return null
    }

    const nextMessage: ChatMessage = {
      ...existingMessage,
      ...update
    }

    const upsertStatement = database.prepare(`
      INSERT INTO chat_messages (
        message_id,
        timestamp,
        channel_name,
        character_id,
        sender_name,
        message_text,
        message_type,
        session_file_path,
        translation_status,
        translated_text,
        error_message,
        updated_at
      ) VALUES (
        $messageId,
        $timestamp,
        $channelName,
        $characterId,
        $senderName,
        $messageText,
        $messageType,
        $sessionFilePath,
        $translationStatus,
        $translatedText,
        $errorMessage,
        $updatedAt
      )
      ON CONFLICT(message_id) DO UPDATE SET
        timestamp = excluded.timestamp,
        channel_name = excluded.channel_name,
        character_id = excluded.character_id,
        sender_name = excluded.sender_name,
        message_text = excluded.message_text,
        message_type = excluded.message_type,
        session_file_path = excluded.session_file_path,
        translation_status = excluded.translation_status,
        translated_text = excluded.translated_text,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at
    `)

    upsertStatement.run(this.toStatementParams(nextMessage))
    upsertStatement.free()
    await this.persist()
    return nextMessage
  }

  private async persist(): Promise<void> {
    const database = this.getDatabase()
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, Buffer.from(database.export()))
  }

  private initializeSchema(): void {
    const database = this.getDatabase()

    database.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        message_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        character_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        message_text TEXT NOT NULL,
        message_type TEXT NOT NULL,
        session_file_path TEXT NOT NULL,
        translation_status TEXT NOT NULL,
        translated_text TEXT,
        error_message TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_character_time
      ON chat_messages (character_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp
      ON chat_messages (timestamp DESC);
    `)
  }

  private getDatabase(): Database {
    if (!this.database) {
      throw new Error('MessageRepository has not been loaded yet.')
    }

    return this.database
  }

  private mapRowToMessage(row: StoredMessageRow): ChatMessage {
    return {
      messageId: row.message_id,
      timestamp: row.timestamp,
      channelName: row.channel_name,
      characterId: row.character_id,
      senderName: row.sender_name,
      messageText: row.message_text,
      messageType: row.message_type as ChatMessage['messageType'],
      sessionFilePath: row.session_file_path,
      translationStatus: row.translation_status as ChatMessage['translationStatus'],
      translatedText: row.translated_text,
      errorMessage: row.error_message
    }
  }

  private findMessage(messageId: string): ChatMessage | null {
    const database = this.getDatabase()
    const statement = database.prepare('SELECT * FROM chat_messages WHERE message_id = $messageId')
    statement.bind({ $messageId: messageId })

    const message = statement.step() ? this.mapRowToMessage(statement.getAsObject() as StoredMessageRow) : null
    statement.free()
    return message
  }

  private mergeMessage(existingMessage: ChatMessage | null, incomingMessage: ChatMessage): ChatMessage {
    if (!existingMessage) {
      return incomingMessage
    }

    const shouldPreserveTranslation =
      incomingMessage.translationStatus === 'idle' && PRESERVED_TRANSLATION_STATUSES.has(existingMessage.translationStatus)

    return {
      ...incomingMessage,
      translationStatus: shouldPreserveTranslation ? existingMessage.translationStatus : incomingMessage.translationStatus,
      translatedText: incomingMessage.translatedText ?? existingMessage.translatedText,
      errorMessage: incomingMessage.errorMessage ?? (shouldPreserveTranslation ? existingMessage.errorMessage : null)
    }
  }

  private toStatementParams(message: ChatMessage) {
    return {
      $messageId: message.messageId,
      $timestamp: message.timestamp,
      $channelName: message.channelName,
      $characterId: message.characterId,
      $senderName: message.senderName,
      $messageText: message.messageText,
      $messageType: message.messageType,
      $sessionFilePath: message.sessionFilePath,
      $translationStatus: message.translationStatus,
      $translatedText: message.translatedText,
      $errorMessage: message.errorMessage,
      $updatedAt: new Date().toISOString()
    }
  }

  private async pruneOldMessages(): Promise<void> {
    const database = this.getDatabase()
    database.run(
      `
        DELETE FROM chat_messages
        WHERE message_id IN (
          SELECT message_id
          FROM chat_messages
          ORDER BY timestamp DESC
          LIMIT -1 OFFSET $limit
        )
      `,
      {
        $limit: this.maxMessages
      }
    )
  }

  private async migrateLegacyJsonIfPresent(): Promise<void> {
    const legacyFilePath = join(dirname(this.filePath), 'messages.json')

    if (legacyFilePath === this.filePath) {
      return
    }

    const legacyExists = await stat(legacyFilePath)
      .then(() => true)
      .catch(() => false)

    if (!legacyExists) {
      return
    }

    try {
      const raw = await readFile(legacyFilePath, 'utf8')
      const payload = JSON.parse(raw) as { messages?: ChatMessage[] }
      const messages = Array.isArray(payload.messages) ? payload.messages : []

      if (messages.length > 0) {
        await this.upsertMessages(messages)
      }

      const migratedFilePath = `${legacyFilePath}.migrated`
      await unlink(migratedFilePath).catch(() => undefined)
      await rename(legacyFilePath, migratedFilePath)
    } catch {
      return
    }
  }

  static createDefaultFilePath(userDataDirectory: string): string {
    return join(userDataDirectory, 'messages.sqlite')
  }
}