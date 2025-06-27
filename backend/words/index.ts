

// Helper functions using the singleton instance
import { dictionaryManager } from './DictionaryManager';

export const getRandomWord = (languageCode?: string) => dictionaryManager.getRandomWord(languageCode);
export const isValidWord = (word: string, languageCode?: string) => dictionaryManager.isValidWord(word, languageCode);
export const getAvailableLanguages = () => dictionaryManager.getAvailableLanguages();
export const isLanguageSupported = (languageCode: string) => dictionaryManager.isLanguageSupported(languageCode);
