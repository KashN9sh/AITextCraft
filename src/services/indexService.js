/**
 * Сервис для индексирования и поиска в содержимом дневника
 */
import { invoke } from "@tauri-apps/api/core";

// Регулярное выражение для поиска тегов (@tag или #tag)
const TAG_REGEX = /(?:^|\s)([#@][a-zа-яё0-9_-]+)/gi;
// Регулярное выражение для выделения слов (включая русские буквы)
const WORD_REGEX = /([a-zа-яё0-9_-]{3,})/gi;

class IndexService {
  constructor() {
    this.wordIndex = new Map(); // Карта слово -> частота
    this.tagIndex = new Map();  // Карта тег -> частота
    this.phraseIndex = new Map(); // Карта фраза -> частота
    this.initialized = false;
  }

  /**
   * Индексирует содержимое всех страниц дневника
   * @param {Array} pages - Массив страниц из состояния приложения
   */
  async indexAllPages(pages) {
    try {
      await invoke('clear_index');
      for (const page of pages) {
        await this.indexContent(page.content);
      }
    } catch (error) {
      console.error('Error indexing pages:', error);
    }
  }

  /**
   * Индексирует содержимое одной страницы
   * @param {string} content - Текстовое содержимое страницы
   */
  async indexContent(content) {
    try {
      await invoke('index_content', { content });
    } catch (error) {
      console.error('Error indexing content:', error);
    }
  }

  /**
   * Находит подходящие слова, теги или фразы для автодополнения
   * @param {string} prefix - Префикс для поиска
   * @param {number} limit - Максимальное количество результатов
   * @returns {Array} - Массив подходящих вариантов
   */
  async findCompletions(prefix, limit = 10) {
    try {
      const results = await invoke('find_completions', { prefix, limit });
      return results.map(([text, type, count]) => ({
        text,
        type,
        count
      }));
    } catch (error) {
      console.error('Error finding completions:', error);
      return [];
    }
  }
}

export default new IndexService(); 