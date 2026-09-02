/**
 * Bundled example payloads. Committed so the app never fetches anything and
 * so the oracle corpus and the sample chooser cannot drift apart.
 */
export interface Sample {
  id: string;
  label: string;
  note: string;
  payload: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'qris-warung',
    label: 'QRIS warung',
    note: 'Statis, merchant kecil. Lensa QRIS aktif.',
    payload:
      '00020101021126610014COM.GO-JEK.WWW01189360091432000000010215MID000000000010303UMI51440014ID.CO.QRIS.WWW0215ID10200000000010303UMI5204581253033605802ID5910Warung Sae6007Sleman61055528162070703A0163046C3E',
  },
  {
    id: 'qris-kopi',
    label: 'QRIS kedai kopi',
    note: 'Payload lebih panjang, versi lebih besar.',
    payload:
      '00020101021126670016COM.NOBUBANK.WWW01189360050300000898240214000089824000010303UMI51440014ID.CO.QRIS.WWW0215ID20200205480580303UMI5204581253033605802ID5920Kopi Kenangan Depok6005DEPOK61051641162070703A0163041F9C',
  },
  {
    id: 'url',
    label: 'Alamat web',
    note: 'Mode byte. Ini yang paling sering dipindai orang.',
    payload: 'https://anatomi.example.id/qris',
  },
  {
    id: 'wifi',
    label: 'Kredensial Wi-Fi',
    note: 'Format yang dikenali kamera ponsel, bukan standar EMVCo.',
    payload: 'WIFI:T:WPA;S:Kopi Kenangan;P:selamatngoding;H:false;;',
  },
  {
    id: 'numeric',
    label: 'Angka saja',
    note: 'Mode numerik: tiga digit muat dalam sepuluh bit.',
    payload: '628123456789012345678901234567890',
  },
  {
    id: 'alnum',
    label: 'Huruf besar dan angka',
    note: 'Mode alfanumerik: dua karakter dalam sebelas bit.',
    payload: 'ANATOMI QRIS 2026 / VERSI 1.0',
  },
  {
    id: 'kalimat',
    label: 'Kalimat panjang',
    note: 'Teks Indonesia dengan tanda baca, memaksa mode byte.',
    payload:
      'Sebuah kode QR menyimpan teks sebagai deretan modul hitam dan putih, lengkap dengan koreksi galat.',
  },
];
