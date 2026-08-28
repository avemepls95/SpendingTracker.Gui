export abstract class FlagEmojiiConverter
{
  static codeEmojiiPairs: Record<string, string> = {
    '🇷🇺': 'https://flagcdn.com/w20/ru.png',
    '🇮🇱': 'https://flagcdn.com/w20/il.png',
    '🇺🇸': 'https://flagcdn.com/w20/us.png',
    '🇪🇺': 'https://flagcdn.com/w20/eu.png',
    '🇨🇳': 'https://flagcdn.com/w20/cn.png',
    '🇯🇴': 'https://flagcdn.com/w20/jo.png',
  }

  static getSrcByEmojiCode(code: string): string {
    return this.codeEmojiiPairs[code];
  }
}
