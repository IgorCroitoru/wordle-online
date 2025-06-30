import * as fs from 'fs';
import * as path from 'path';

export interface LanguageConfig {
  code: string;
  name: string;
  words: Set<string>;
  exceptions: Set<string>;
  wordsArray: string[]; // Keep array for random selection
}

export class DictionaryManager {
  private dictionaries: Map<string, LanguageConfig> = new Map();
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../data')) {
    console.log("Current working directory:", __dirname);
    console.log(`📂 Initializing DictionaryManager with data path: ${dataPath}`);
    this.dataPath = dataPath;
    this.loadAllDictionaries();
  }

  /**
   * Load all dictionaries from the data folder
   */
  private loadAllDictionaries(): void {
    try {
      if (!fs.existsSync(this.dataPath)) {
        console.warn(`Data directory not found: ${this.dataPath}`);
        return;
      }

      const languageFolders = fs.readdirSync(this.dataPath)
        .filter(item => {
          const fullPath = path.join(this.dataPath, item);
          return fs.statSync(fullPath).isDirectory();
        });

      console.log(`📚 Loading dictionaries for languages: ${languageFolders.join(', ')}`);

      for (const languageCode of languageFolders) {
        try {
          this.loadLanguageDictionary(languageCode);
        } catch (error) {
          console.error(`❌ Failed to load dictionary for ${languageCode}:`, error);
        }
      }

      console.log(`✅ Loaded ${this.dictionaries.size} dictionaries`);
    } catch (error) {
      console.error('❌ Error loading dictionaries:', error);
    }
  }

  /**
   * Load dictionary for a specific language
   */
  private loadLanguageDictionary(languageCode: string): void {
    const languagePath = path.join(this.dataPath, languageCode);
    const dictionaryFile = path.join(languagePath, `${languageCode}.txt`);
    const exceptionsFile = path.join(languagePath, 'exceptions.txt');

    // Load main dictionary
    let rawWords: string[] = [];
    if (fs.existsSync(dictionaryFile)) {
      const content = fs.readFileSync(dictionaryFile, 'utf-8');
      rawWords = this.parseWordsFromContent(content);
    } else {
      console.warn(`⚠️  Dictionary file not found: ${dictionaryFile}`);
      return;
    }

    // Load exceptions/curse words
    let exceptions: string[] = [];
    if (fs.existsSync(exceptionsFile)) {
      const content = fs.readFileSync(exceptionsFile, 'utf-8');
      exceptions = this.parseWordsFromContent(content);
    }    // Filter and process words
    const validWords = this.filterValidWords(rawWords, exceptions, languageCode);

    const languageConfig: LanguageConfig = {
      code: languageCode,
      name: this.getLanguageName(languageCode),
      words: new Set(validWords),
      exceptions: new Set(exceptions.map(word => word.toLowerCase())),
      wordsArray: validWords
    };

    this.dictionaries.set(languageCode, languageConfig);

    console.log(`📖 ${languageConfig.name} (${languageCode}): ${validWords.length} valid words`);
  }


    /**
   * Get human-readable language name
   */
  private getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ro': 'Romanian',
      'ru': 'Russian',
      'pl': 'Polish',
      'nl': 'Dutch',
      'da': 'Danish',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'hu': 'Hungarian',
      'cs': 'Czech',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'hr': 'Croatian',
      'sr': 'Serbian',
      'bg': 'Bulgarian',
      'mk': 'Macedonian',
      'sq': 'Albanian',
      'lt': 'Lithuanian',
      'lv': 'Latvian',
      'et': 'Estonian'
    };

    return languageNames[code] || code.toUpperCase();
  }
  /**
   * Parse words from file content (handles comma-separated and newline-separated)
   */
  private parseWordsFromContent(content: string): string[] {
    // First try comma separation, then newline separation
    let words: string[] = [];
    
    if (content.includes(',')) {
      // Comma-separated
      words = content.split(',');
    } else {
      // Newline-separated
      words = content.split(/\r?\n/);
    }

    return words
      .map(word => word.trim())
      .filter(word => word.length > 0)
      .map(word => word.toLowerCase());
  }  /**
   * Filter words to only include valid 5-letter words without special characters
   */
  private filterValidWords(words: string[], exceptions: string[], languageCode: string): string[] {
    const exceptionSet = new Set(exceptions.map(word => word.toLowerCase()));
    const uniqueWords = new Set<string>();

    // Get language-specific character pattern
    const charPattern = this.getLanguageCharacterPattern(languageCode);

    for (const word of words) {
      // Must be exactly 5 letters
      if (word.length !== 5) continue;

      // Must contain only valid characters for this language
      if (!charPattern.test(word)) continue;

      // Must not be in exceptions list
      if (exceptionSet.has(word.toLowerCase())) continue;

      // Add to unique words set
      uniqueWords.add(word.toUpperCase());
    }

    return Array.from(uniqueWords);
  }

  /**
   * Get language-specific character validation pattern
   */
  private getLanguageCharacterPattern(languageCode: string): RegExp {
    const patterns: Record<string, RegExp> = {
      // English and Western European
      'en': /^[a-zA-Z]+$/,
      'es': /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+$/,
      'fr': /^[a-zA-ZàáâäèéêëìíîïòóôöùúûüÿçÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜŸÇ]+$/,
      'de': /^[a-zA-ZäöüßÄÖÜ]+$/,
      'it': /^[a-zA-ZàáèéìíîóòúÀÁÈÉÌÍÎÓÒÚ]+$/,
      'pt': /^[a-zA-ZáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/,
      'ro': /^[a-zA-ZăâîșțĂÂÎȘȚ]+$/,
      
      // Cyrillic languages
      'ru': /^[а-яёА-ЯЁ]+$/,
      'bg': /^[а-яА-Я]+$/,
      'sr': /^[а-яђћжшчџА-ЯЂЋЖШЧЏ]+$/,
      'mk': /^[а-яѓќљњџА-ЯЃЌЉЊЏ]+$/,
      
      // Other scripts
      'pl': /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/,
      'cs': /^[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/,
      'sk': /^[a-zA-ZáäčďéíľĺňóôŕšťúýžÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ]+$/,
      'hu': /^[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ]+$/,
      'lt': /^[a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ]+$/,
      'lv': /^[a-zA-ZāčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]+$/,
      'et': /^[a-zA-ZäöõüÄÖÕÜ]+$/,
    };

    return patterns[languageCode] || /^[a-zA-Z]+$/; // Default to basic Latin
  }
  /**
   * Get a random word for a specific language
   */
  getRandomWord(languageCode: string = 'en'): string {
    const dictionary = this.dictionaries.get(languageCode);
    
    if (!dictionary || dictionary.wordsArray.length === 0) {
      // Fallback to English if requested language not available
      const englishDict = this.dictionaries.get('en');
      if (!englishDict || englishDict.wordsArray.length === 0) {
        throw new Error('No dictionaries available');
      }
      console.warn(`⚠️  Language ${languageCode} not available, using English`);
      return englishDict.wordsArray[Math.floor(Math.random() * englishDict.wordsArray.length)];
    }

    return dictionary.wordsArray[Math.floor(Math.random() * dictionary.wordsArray.length)];
  }
  /**
   * Check if a word is valid for a specific language
   */
  isValidWord(word: string, languageCode: string = 'en'): boolean {
    const dictionary = this.dictionaries.get(languageCode);
    if (!dictionary) {
      return false;
    }

    return dictionary.words.has(word.toUpperCase());
  }
  /**
   * Get all available languages
   */
  getAvailableLanguages(): { code: string; name: string; wordCount: number }[] {
    return Array.from(this.dictionaries.values())
      .map(dict => ({
        code: dict.code,
        name: dict.name,
        wordCount: dict.words.size
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  /**
   * Get dictionary statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [code, dict] of this.dictionaries) {
      stats[code] = {
        name: dict.name,
        totalWords: dict.words.size,
        exceptions: dict.exceptions.size,
        sampleWords: dict.wordsArray.slice(0, 5) // First 5 words as sample
      };
    }

    return stats;
  }

  /**
   * Reload dictionaries (useful for development)
   */
  reload(): void {
    this.dictionaries.clear();
    this.loadAllDictionaries();
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return this.dictionaries.has(languageCode);
  }
  /**
   * Get all words for a language (for debugging)
   */
  getAllWords(languageCode: string): string[] {
    const dictionary = this.dictionaries.get(languageCode);
    return dictionary ? [...dictionary.wordsArray] : [];
  }
}

// Create a singleton instance
export const dictionaryManager = new DictionaryManager();
