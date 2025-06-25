const fs = require('fs');
const path = require('path');
const https = require('https');

class WordlePlayParser {
  constructor() {
    this.baseUrl = 'https://wordleplay.com/dic';
    this.languages = ['en', 'de', 'es', 'ro', 'ru'];
    this.outputDir = path.join(__dirname, '../../data'); // Data directory
  }

  /**
   * Fetch data from URL using HTTPS
   */
  async fetchData(url) {
    return new Promise((resolve, reject) => {
      console.log(`📡 Fetching: ${url}`);
      
      https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
          response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              // Clean the data before parsing
              let cleanData = data.trim();
              
              // Handle potential BOM or encoding issues
              if (cleanData.charCodeAt(0) === 0xFEFF) {
                cleanData = cleanData.slice(1);
              }
              
              // Try to fix common JSON issues
              if (cleanData.startsWith('["') && !cleanData.endsWith('"]')) {
                // Find the last complete entry and close the array
                const lastCommaIndex = cleanData.lastIndexOf('","');
                if (lastCommaIndex > 0) {
                  cleanData = cleanData.substring(0, lastCommaIndex + 1) + '"]';
                }
              }
              
              const jsonData = JSON.parse(cleanData);
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
          } catch (error) {
            console.error(`Raw response data: ${data.substring(0, 200)}...`);
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    });
  }
  /**
   * Fallback method to extract words from corrupted JSON
   */
  extractWordsFromCorruptedJson(data, languageCode) {
    console.log(`🔧 Attempting to extract words from corrupted ${languageCode} data...`);
    
    // Use regex to find quoted strings that look like 5-letter words
    const wordPattern = /"([a-zA-ZА-Яа-яäöüßáéíóúàèìòùâêîôûãñçüęąśłżźć]{5})"/g;
    const words = [];
    let match;
    
    while ((match = wordPattern.exec(data)) !== null) {
      words.push(match[1]);
    }
    
    console.log(`🔧 Extracted ${words.length} words using regex fallback`);
    return words;
  }

  /**
   * Process and filter words
   */  processWords(words, languageCode) {
    if (!Array.isArray(words)) {
      console.warn(`⚠️  Expected array for ${languageCode}, got:`, typeof words);
      return [];
    }

    const processed = words
      .filter(word => {
        // Must be a string
        if (typeof word !== 'string') return false;
        
        // Must be exactly 5 characters
        if (word.length !== 5) return false;
        
        // Must not contain spaces, hyphens, or special characters
        if (/[\s\-_.'"]/.test(word)) return false;
        
        // Language-specific character validation
        if (languageCode === 'ru') {
          // For Russian, only allow Cyrillic letters
          if (!/^[А-Яа-яЁё]+$/.test(word)) return false;
        } else {
          // For other languages, allow Latin letters with diacritics
          if (!/^[a-zA-Zäöüßáéíóúàèìòùâêîôûãñçüęąśłżźć]+$/.test(word)) return false;
        }
        
        return true;
      })
      .map(word => word.toUpperCase())
      .filter((word, index, array) => array.indexOf(word) === index); // Remove duplicates

    return processed;
  }
  /**
   * Save words to file
   */
  async saveWordsToFile(words, languageCode) {
    // Create language directory if it doesn't exist
    const languageDir = path.join(this.outputDir, languageCode);
    if (!fs.existsSync(languageDir)) {
      await fs.promises.mkdir(languageDir, { recursive: true });
      console.log(`📁 Created directory: ${languageDir}`);
    }

    const fileName = `${languageCode}.txt`;
    const filePath = path.join(languageDir, fileName);
    
    try {
      const content = words.join(',');
      await fs.promises.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Saved ${words.length} words to ${languageCode}/${fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save ${languageCode}/${fileName}:`, error.message);
      return false;
    }
  }
  /**
   * Parse words for a specific language
   */
  async parseLanguage(languageCode) {
    const url = `${this.baseUrl}/${languageCode}/len5.json?v=1.2.1`;
    
    try {
      console.log(`\n🔄 Processing ${languageCode.toUpperCase()}...`);
      
      // Fetch data
      let data;
      try {
        data = await this.fetchData(url);
      } catch (error) {
        // If JSON parsing failed, try to fetch raw data and use regex fallback
        if (error.message.includes('Failed to parse JSON')) {
          console.log(`⚠️  JSON parsing failed for ${languageCode}, trying fallback method...`);
          
          const rawData = await new Promise((resolve, reject) => {
            https.get(url, (response) => {
              let data = '';
              response.on('data', (chunk) => { data += chunk; });
              response.on('end', () => resolve(data));
            }).on('error', reject);
          });
          
          data = this.extractWordsFromCorruptedJson(rawData, languageCode);
        } else {
          throw error;
        }
      }
      
      // Process words
      const processedWords = this.processWords(data, languageCode);
      
      if (processedWords.length === 0) {
        console.warn(`⚠️  No valid words found for ${languageCode}`);
        return false;
      }
      
      // Save to file
      const saved = await this.saveWordsToFile(processedWords, languageCode);
      
      if (saved) {
        console.log(`📊 ${languageCode.toUpperCase()} Statistics:`);
        console.log(`   📚 Total words: ${processedWords.length}`);
        console.log(`   📝 Sample: ${processedWords.slice(0, 5).join(', ')}...`);
      }
      
      return saved;
    } catch (error) {
      console.error(`❌ Failed to process ${languageCode}:`, error.message);
      return false;
    }
  }

  /**
   * Parse all configured languages
   */
  async parseAllLanguages() {
    console.log('🚀 Starting WordlePlay dictionary parsing...');
    console.log(`📍 Output directory: ${this.outputDir}`);
    console.log(`🌍 Languages: ${this.languages.join(', ')}`);
    
    const results = {};
    let successCount = 0;
    
    for (const languageCode of this.languages) {
      const success = await this.parseLanguage(languageCode);
      results[languageCode] = success;
      
      if (success) {
        successCount++;
      }
      
      // Add delay between requests to be respectful
      if (languageCode !== this.languages[this.languages.length - 1]) {
        console.log('⏳ Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Print summary
    console.log('\n📊 PARSING SUMMARY');
    console.log('═'.repeat(40));
    console.log(`✅ Successful: ${successCount}/${this.languages.length}`);
    console.log(`❌ Failed: ${this.languages.length - successCount}/${this.languages.length}`);
    
    console.log('\n📋 Results:');
    for (const [lang, success] of Object.entries(results)) {
      console.log(`   ${success ? '✅' : '❌'} ${lang.toUpperCase()}`);
    }
    
    if (successCount > 0) {
      console.log(`\n🎉 Successfully parsed ${successCount} dictionaries!`);
      console.log(`📁 Files saved in: ${this.outputDir}`);
    }
    
    return results;
  }
  /**
   * Create a sample exceptions file
   */
  async createSampleExceptions() {
    const sampleExceptions = {
      'en': ['ABUSE', 'ANGER', 'BEAST', 'BITCH', 'BLOOD', 'BOMBS', 'COCKS', 'DEATH', 'DEVIL', 'DRUGS', 'DRUNK', 'ENEMY', 'FIGHT', 'FRAUD', 'GUILT', 'HATED', 'KILLS', 'KNIFE', 'LURED', 'LYNCH', 'NAKED', 'PARIS', 'PENIS', 'PUNCH', 'RAPED', 'SATAN', 'SLAVE', 'SLUMS', 'SNOBS', 'SPANK', 'STEAL', 'SUCKS', 'SWEAR', 'TEARS', 'THEFT', 'THIEF', 'TOXIC', 'TRASH', 'TURNS', 'TWIST', 'WENCH', 'WHORE', 'WITCH', 'WRATH'],
      'de': ['ARSCH', 'BLÖDE', 'DUMME', 'FICKE', 'KACKE', 'PISSE', 'SCHEI'],
      'es': ['BRUTO', 'IDIOTA', 'MALDITO', 'ODIAR', 'PERRA', 'PUTOS'],
      'ro': ['PROST', 'IDIOT', 'NEBUN', 'URATA', 'JOACA'],
      'ru': ['ДУРАК', 'ИДИОТ', 'ПЛОХО', 'СВОЛШ', 'ЧЕРТУ']
    };

    console.log('\n📝 Creating sample exceptions files...');
    
    for (const [lang, exceptions] of Object.entries(sampleExceptions)) {
      // Create language directory if it doesn't exist
      const languageDir = path.join(this.outputDir, lang);
      if (!fs.existsSync(languageDir)) {
        await fs.promises.mkdir(languageDir, { recursive: true });
        console.log(`📁 Created directory: ${languageDir}`);
      }

      const fileName = 'exceptions.txt';
      const filePath = path.join(languageDir, fileName);
      
      try {
        const content = exceptions.join(',');
        await fs.promises.writeFile(filePath, content, 'utf-8');
        console.log(`✅ Created ${lang}/exceptions.txt with ${exceptions.length} exceptions`);
      } catch (error) {
        console.error(`❌ Failed to create ${lang}/exceptions.txt:`, error.message);
      }
    }
  }
}

// CLI usage
async function main() {
  const parser = new WordlePlayParser();
  
  try {    // Parse all languages
    await parser.parseAllLanguages();
    
    // Create sample exceptions
    await parser.createSampleExceptions();
    
    console.log('\n✨ All done! You can now use these files with DictionaryManager.');
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = { WordlePlayParser };

// Run if called directly
if (require.main === module) {
  main();
}
