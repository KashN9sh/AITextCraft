/**
 * Сервис для индексирования и поиска в содержимом дневника
 */

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
  indexAllPages(pages) {
    // Очищаем существующие индексы
    this.wordIndex.clear();
    this.tagIndex.clear();
    this.phraseIndex.clear();

    // Индексируем каждую страницу
    pages.forEach(page => {
      if (page.content) {
        this.indexContent(page.content);
      }
    });

    this.initialized = true;

  }

  /**
   * Индексирует содержимое одной страницы
   * @param {string} content - Текстовое содержимое страницы
   */
  indexContent(content) {
    // Индексируем теги
    const tagMatches = [...content.matchAll(TAG_REGEX)];
    tagMatches.forEach(match => {
      const tag = match[1].toLowerCase();
      this.tagIndex.set(tag, (this.tagIndex.get(tag) || 0) + 1);
    });

    // Индексируем слова
    const wordMatches = [...content.matchAll(WORD_REGEX)];
    wordMatches.forEach(match => {
      const word = match[1].toLowerCase();
      if (word.length >= 3) { // Индексируем только слова длиной от 3 символов
        this.wordIndex.set(word, (this.wordIndex.get(word) || 0) + 1);
      }
    });

    // Индексируем фразы (2-3 слова подряд)
    const words = content.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length >= 3 && words[i+1].length >= 3) {
        const phrase = (words[i] + ' ' + words[i+1]).toLowerCase();
        this.phraseIndex.set(phrase, (this.phraseIndex.get(phrase) || 0) + 1);
      }
      
      // Фразы из 3 слов
      if (i < words.length - 2 && words[i+2].length >= 3) {
        const phrase = (words[i] + ' ' + words[i+1] + ' ' + words[i+2]).toLowerCase();
        this.phraseIndex.set(phrase, (this.phraseIndex.get(phrase) || 0) + 1);
      }
    }
  }

  /**
   * Находит подходящие слова, теги или фразы для автодополнения
   * @param {string} prefix - Префикс для поиска
   * @param {number} limit - Максимальное количество результатов
   * @returns {Array} - Массив подходящих вариантов
   */
  findCompletions(prefix, limit = 5) {
    if (!this.initialized || !prefix || prefix.length < 2) {
      return [];
    }

    const lowerPrefix = prefix.toLowerCase();
    console.log('Поиск автодополнений для:', lowerPrefix); // Отладочный вывод
    let results = [];

    // Если префикс начинается с @ или #, ищем по тегам
    if (lowerPrefix.startsWith('@') || lowerPrefix.startsWith('#')) {
      // Ищем теги, начинающиеся с префикса
      for (const [tag, count] of this.tagIndex.entries()) {
        if (tag.startsWith(lowerPrefix)) {
          results.push({ text: tag, type: 'tag', count });
        }
      }
    } 
    // Иначе ищем по словам и фразам
    else {
      // Проверяем, есть ли пробел в префиксе - если да, то ищем по фразам
      if (lowerPrefix.includes(' ')) {
        for (const [phrase, count] of this.phraseIndex.entries()) {
          if (phrase.startsWith(lowerPrefix)) {
            results.push({ text: phrase, type: 'phrase', count });
          }
        }
      } else {
        // Ищем слова, начинающиеся с префикса
        for (const [word, count] of this.wordIndex.entries()) {
          if (word.startsWith(lowerPrefix)) {
            results.push({ text: word, type: 'word', count });
          }
        }
      }
    }

    console.log('Найденные результаты:', results); // Отладочный вывод
    // Сортируем результаты по частоте (сначала самые частые)
    results.sort((a, b) => b.count - a.count);
    
    // Ограничиваем количество результатов
    results = results.slice(0, limit);

    // Убираем дубликаты по text
    const uniqueResults = [];
    const seen = new Set();
    for (const item of results) {
      if (!seen.has(item.text)) {
        uniqueResults.push(item);
        seen.add(item.text);
      }
    }
    return uniqueResults;
  }
}

export default new IndexService(); 