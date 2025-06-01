use std::collections::HashMap;
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    static ref TAG_REGEX: Regex = Regex::new(r"(?:^|\s)([#@][a-zа-яё0-9_-]+)").unwrap();
    static ref WORD_REGEX: Regex = Regex::new(r"([a-zа-яё0-9_-]{3,})").unwrap();
}

#[derive(Default)]
pub struct Indexer {
    word_index: HashMap<String, u32>,
    tag_index: HashMap<String, u32>,
    phrase_index: HashMap<String, u32>,
    templates: HashMap<String, Vec<String>>,
}

impl Indexer {
    pub fn new() -> Self {
        let mut indexer = Self::default();
        indexer.init_templates();
        indexer
    }

    fn init_templates(&mut self) {
        // Шаблоны для списков
        self.templates.insert("список".to_string(), vec![
            "- [ ] ".to_string(),
            "- [ ] - ".to_string(),
            "1. ".to_string(),
        ]);

        // Шаблоны для заголовков
        self.templates.insert("заголовок".to_string(), vec![
            "# ".to_string(),
            "## ".to_string(),
            "### ".to_string(),
        ]);

        // Шаблоны для форматирования
        self.templates.insert("жирный".to_string(), vec![
            "**".to_string(),
        ]);

        self.templates.insert("курсив".to_string(), vec![
            "*".to_string(),
        ]);

        self.templates.insert("код".to_string(), vec![
            "`".to_string(),
            "```".to_string(),
        ]);

        // Шаблоны для таблиц
        self.templates.insert("таблица".to_string(), vec![
            "| | |\n| --- | --- |\n| | |".to_string(),
        ]);

        // Шаблоны для цитат
        self.templates.insert("цитата".to_string(), vec![
            "> ".to_string(),
        ]);

        // Шаблоны для ссылок
        self.templates.insert("ссылка".to_string(), vec![
            "[текст](url)".to_string(),
        ]);

        // Шаблоны для изображений
        self.templates.insert("изображение".to_string(), vec![
            "![alt](url)".to_string(),
        ]);

        // Шаблоны для задач
        self.templates.insert("задача".to_string(), vec![
            "- [ ] ".to_string(),
        ]);

        // Шаблоны для заметок
        self.templates.insert("заметка".to_string(), vec![
            "> 💡 ".to_string(),
            "> 📝 ".to_string(),
            "> ⚠️ ".to_string(),
        ]);
    }

    pub fn index_content(&mut self, content: &str) {
        // Индексируем теги
        for cap in TAG_REGEX.captures_iter(content) {
            if let Some(tag) = cap.get(1) {
                let tag = tag.as_str().to_lowercase();
                *self.tag_index.entry(tag).or_insert(0) += 1;
            }
        }

        // Индексируем слова
        for cap in WORD_REGEX.captures_iter(content) {
            if let Some(word) = cap.get(1) {
                let word = word.as_str().to_lowercase();
                if word.len() >= 3 {
                    *self.word_index.entry(word).or_insert(0) += 1;
                }
            }
        }

        // Индексируем фразы (2-3 слова подряд)
        let words: Vec<&str> = content.split_whitespace().collect();
        for i in 0..words.len() {
            if i + 1 < words.len() {
                let word1 = words[i].to_lowercase();
                let word2 = words[i + 1].to_lowercase();
                if word1.len() >= 3 && word2.len() >= 3 {
                    let phrase = format!("{} {}", word1, word2);
                    *self.phrase_index.entry(phrase).or_insert(0) += 1;
                }
            }
            if i + 2 < words.len() {
                let word1 = words[i].to_lowercase();
                let word2 = words[i + 1].to_lowercase();
                let word3 = words[i + 2].to_lowercase();
                if word1.len() >= 3 && word2.len() >= 3 && word3.len() >= 3 {
                    let phrase = format!("{} {} {}", word1, word2, word3);
                    *self.phrase_index.entry(phrase).or_insert(0) += 1;
                }
            }
        }
    }

    pub fn find_completions(&self, prefix: &str, limit: usize) -> Vec<(String, String, u32)> {
        if prefix.len() < 2 {
            return Vec::new();
        }

        let prefix = prefix.to_lowercase();
        let mut results = Vec::new();

        // Проверяем шаблоны
        for (template_name, templates) in &self.templates {
            if template_name.contains(&prefix) {
                for template in templates {
                    results.push((template.clone(), "template".to_string(), 100));
                }
            }
        }

        // Если префикс начинается с @ или #, ищем по тегам
        if prefix.starts_with('@') || prefix.starts_with('#') {
            for (tag, count) in &self.tag_index {
                if tag.starts_with(&prefix) {
                    results.push((tag.clone(), "tag".to_string(), *count));
                }
            }
        } else {
            // Проверяем, есть ли пробел в префиксе
            if prefix.contains(' ') {
                // Ищем по фразам
                for (phrase, count) in &self.phrase_index {
                    if phrase.starts_with(&prefix) {
                        results.push((phrase.clone(), "phrase".to_string(), *count));
                    }
                }
            } else {
                // Ищем по словам
                for (word, count) in &self.word_index {
                    if word.starts_with(&prefix) {
                        results.push((word.clone(), "word".to_string(), *count));
                    }
                }
            }
        }

        // Сортируем по частоте и ограничиваем количество результатов
        results.sort_by(|a, b| b.2.cmp(&a.2));
        results.truncate(limit);

        results
    }

    pub fn clear(&mut self) {
        self.word_index.clear();
        self.tag_index.clear();
        self.phrase_index.clear();
    }
} 