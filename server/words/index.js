const fs = require('fs');
const path = require('path');

function parseRomanianWords() {
    try {
        const filePath = path.join(__dirname, './data/big_romanian_list.txt');
        const data = fs.readFileSync(filePath, 'utf8');
        
        // Split by lines and filter out empty lines
        const words = data
            .split('\n')
            .map(word => word.trim())
            .filter(word => word.length > 0);
        
        return words;
    } catch (error) {
        console.error('Error parsing Romanian.txt:', error);
        return [];
    }
}
const words = parseRomanianWords();
console.log('Parsed Romanian words:', words.filter(word => word.length === 5).length);
module.exports = {
    parseRomanianWords
};