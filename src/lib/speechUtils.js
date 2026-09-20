/**
 * Utility functions for Thai speech synthesis in Queue Management
 */

export const queueToThaiSpeech = (displayQueueNumber) => {
  if (!displayQueueNumber) return '';
  const str = String(displayQueueNumber).trim();
  const match = str.match(/^([A-Za-z]+)?[- ]?(\d+)$/);
  if (!match) return str;

  const letters = match[1] ? match[1].toUpperCase() : '';
  const numbers = match[2];

  const letterMap = {
    'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี', 'F': 'เอฟ',
    'G': 'จี', 'H': 'เอช', 'I': 'ไอ', 'J': 'เจ', 'K': 'เค', 'L': 'แอล',
    'M': 'เอ็ม', 'N': 'เอ็น', 'O': 'โอ', 'P': 'พี', 'Q': 'คิว', 'R': 'อาร์',
    'S': 'เอส', 'T': 'ที', 'U': 'ยู', 'V': 'วี', 'W': 'ดับเบิ้ลยู',
    'X': 'เอ็กซ์', 'Y': 'วาย', 'Z': 'แซด'
  };

  const digitMap = {
    '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
    '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
  };

  let speech = '';
  for (const char of letters) {
    speech += (letterMap[char] || char) + ', ';
  }
  for (const digit of numbers) {
    speech += (digitMap[digit] || digit) + ', ';
  }

  return speech.trim();
};

export const channelNameToThai = (channelName) => {
  if (!channelName) return '';
  const wordMap = {
    'AERO': 'แอโร่',
    'VIP': 'วีไอพี',
    'SERVICE': 'เซอร์วิส',
    'COUNTER': 'เคาน์เตอร์',
    'DESK': 'เดสก์',
    'STATION': 'สเตชั่น',
    'ZONE': 'โซน',
    'ROOM': 'รูม'
  };

  const digitToThai = {
    '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
    '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
  };

  let result = channelName.toUpperCase();
  for (const [en, th] of Object.entries(wordMap)) {
    result = result.replace(new RegExp(`\\b${en}\\b`, 'g'), th);
  }

  result = result.replace(/\d/g, (d) => ` ${digitToThai[d]} `);
  return result.trim();
};
