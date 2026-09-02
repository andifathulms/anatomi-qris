/**
 * Tag meanings for EMVCo Merchant-Presented Mode and the QRIS profile.
 * Indonesian first, per DESIGN.md §7. Terms of art stay in English where no
 * settled Indonesian equivalent exists.
 */

export const TEMPLATE_TAGS: Array<[string, string]> = [
  ['26', '51'],
  ['62', '62'],
  ['64', '64'],
  ['80', '99'],
];

/** Root tags, EMVCo MPM §4. */
const ROOT: Record<string, string> = {
  '00': 'Indikator format payload',
  '01': 'Titik inisiasi: statis atau dinamis',
  '52': 'Kategori usaha (MCC)',
  '53': 'Kode mata uang',
  '54': 'Nominal transaksi',
  '55': 'Indikator biaya tambahan',
  '56': 'Biaya tambahan tetap',
  '57': 'Biaya tambahan persentase',
  '58': 'Kode negara',
  '59': 'Nama merchant',
  '60': 'Kota merchant',
  '61': 'Kode pos',
  '62': 'Data tambahan',
  '63': 'Checksum CRC16',
  '64': 'Nama merchant dalam bahasa lain',
};

/** Sub-tags inside a merchant account information template (26-51). */
const MERCHANT_ACCOUNT: Record<string, string> = {
  '00': 'Pengenal global (reverse domain atau ID.CO.QRIS.WWW)',
  '01': 'Pengenal merchant pada acquirer',
  '02': 'Pengenal merchant nasional',
  '03': 'Kriteria merchant',
};

/** Sub-tags inside the additional data field template (62). */
const ADDITIONAL_DATA: Record<string, string> = {
  '01': 'Nomor tagihan',
  '02': 'Nomor ponsel',
  '03': 'Nomor toko',
  '04': 'Nomor loyalitas',
  '05': 'Nomor referensi',
  '06': 'Nomor pelanggan',
  '07': 'Nomor terminal',
  '08': 'Keperluan transaksi',
  '09': 'Permintaan data konsumen',
};

/** Sub-tags inside the merchant information language template (64). */
const LANGUAGE: Record<string, string> = {
  '00': 'Preferensi bahasa',
  '01': 'Nama merchant dalam bahasa itu',
  '02': 'Kota merchant dalam bahasa itu',
};

/** Merchant criteria codes QRIS puts under sub-tag 03. */
export const MERCHANT_CRITERIA: Record<string, string> = {
  UMI: 'Usaha mikro',
  UKE: 'Usaha kecil',
  UME: 'Usaha menengah',
  UBE: 'Usaha besar',
  URE: 'Badan layanan umum atau lembaga',
};

export const INITIATION_METHOD: Record<string, string> = {
  '11': 'Statis — satu QR dipakai berulang, nominal diketik pembeli',
  '12': 'Dinamis — QR sekali pakai, nominal sudah tertanam',
};

/** ISO 4217 numeric codes seen in this context. */
export const CURRENCY: Record<string, string> = {
  '360': 'IDR — rupiah',
  '840': 'USD — dolar Amerika',
  '702': 'SGD — dolar Singapura',
  '458': 'MYR — ringgit Malaysia',
  '764': 'THB — baht Thailand',
};

/**
 * ISO 18245 merchant category codes. A working subset covering what a QRIS
 * sticker in Indonesia actually carries, so tag 52 reads as a business rather
 * than as four digits.
 */
export const MCC: Record<string, string> = {
  '0000': 'Tidak dikategorikan',
  '4111': 'Transportasi umum',
  '4121': 'Taksi dan ojek',
  '4131': 'Bus antarkota',
  '4784': 'Tol dan jembatan',
  '4814': 'Telekomunikasi dan pulsa',
  '4816': 'Layanan internet',
  '4899': 'Televisi kabel dan berlangganan',
  '4900': 'Listrik, air, dan gas',
  '5192': 'Buku dan majalah',
  '5211': 'Bahan bangunan',
  '5251': 'Perkakas',
  '5311': 'Toko serba ada',
  '5331': 'Toko kelontong',
  '5411': 'Supermarket dan minimarket',
  '5422': 'Daging dan hasil laut',
  '5441': 'Toko kue dan permen',
  '5451': 'Produk susu',
  '5462': 'Toko roti',
  '5499': 'Toko makanan lain',
  '5541': 'Pengisian bahan bakar',
  '5611': 'Pakaian pria',
  '5621': 'Pakaian wanita',
  '5641': 'Pakaian anak',
  '5651': 'Pakaian keluarga',
  '5661': 'Toko sepatu',
  '5691': 'Butik',
  '5712': 'Perabot rumah',
  '5732': 'Elektronik',
  '5733': 'Alat musik',
  '5734': 'Perangkat lunak',
  '5735': 'Musik dan rekaman',
  '5812': 'Restoran',
  '5813': 'Bar dan kedai minuman',
  '5814': 'Makanan cepat saji',
  '5912': 'Apotek',
  '5921': 'Toko minuman beralkohol',
  '5931': 'Barang bekas',
  '5941': 'Perlengkapan olahraga',
  '5942': 'Toko buku',
  '5943': 'Alat tulis dan kantor',
  '5944': 'Perhiasan dan jam',
  '5945': 'Mainan dan permainan',
  '5946': 'Kamera dan fotografi',
  '5947': 'Toko suvenir dan kado',
  '5977': 'Kosmetik',
  '5992': 'Toko bunga',
  '5993': 'Rokok dan tembakau',
  '5999': 'Ritel lain',
  '7011': 'Hotel dan penginapan',
  '7210': 'Binatu',
  '7230': 'Salon dan pangkas rambut',
  '7298': 'Perawatan tubuh dan spa',
  '7299': 'Jasa perorangan lain',
  '7311': 'Jasa periklanan',
  '7392': 'Konsultan dan hubungan masyarakat',
  '7399': 'Jasa usaha lain',
  '7523': 'Parkir',
  '7538': 'Bengkel kendaraan',
  '7542': 'Cuci kendaraan',
  '7832': 'Bioskop',
  '7911': 'Sanggar tari',
  '7941': 'Klub olahraga dan lapangan',
  '7991': 'Museum dan tempat wisata',
  '7997': 'Klub kebugaran',
  '7999': 'Rekreasi lain',
  '8011': 'Praktik dokter',
  '8021': 'Praktik dokter gigi',
  '8031': 'Praktik pengobatan tradisional',
  '8041': 'Praktik kiropraktik dan fisioterapi',
  '8042': 'Optik',
  '8062': 'Rumah sakit',
  '8071': 'Laboratorium medis',
  '8099': 'Layanan kesehatan lain',
  '8211': 'Sekolah dasar dan menengah',
  '8220': 'Perguruan tinggi',
  '8241': 'Sekolah jarak jauh',
  '8299': 'Pendidikan lain',
  '8351': 'Penitipan anak',
  '8398': 'Organisasi sosial',
  '8641': 'Organisasi masyarakat',
  '8661': 'Rumah ibadah',
  '8699': 'Keanggotaan organisasi lain',
  '8999': 'Jasa profesional lain',
  '9399': 'Layanan pemerintah',
};

/**
 * Well-known globally unique identifiers under sub-tag 00 of a merchant
 * account template. Naming the acquirer is most of what a reader wants.
 */
export const ACQUIRER: Record<string, string> = {
  'ID.CO.QRIS.WWW': 'QRIS nasional — dikelola ASPI dan Bank Indonesia',
  'COM.GO-JEK.WWW': 'GoPay',
  'ID.CO.SHOPEE.WWW': 'ShopeePay',
  'COM.DANA.WWW': 'DANA',
  'ID.LINKAJA.WWW': 'LinkAja',
  'ID.CO.OVO.WWW': 'OVO',
  'COM.NOBUBANK.WWW': 'Bank Nobu',
  'ID.CO.BCA.WWW': 'Bank Central Asia',
  'ID.CO.BANKMANDIRI.WWW': 'Bank Mandiri',
  'ID.CO.BRI.WWW': 'Bank Rakyat Indonesia',
  'ID.CO.BNI.WWW': 'Bank Negara Indonesia',
  'ID.CO.PERMATABANK.WWW': 'Bank Permata',
  'ID.CO.CIMBNIAGA.WWW': 'CIMB Niaga',
  'ID.CO.BANKSINARMAS.WWW': 'Bank Sinarmas',
};

/** The meaning of a node, addressed by its dotted tag path. */
export function meaningFor(path: string): string | null {
  const parts = path.split('.');
  if (parts.length === 1) {
    const tag = parts[0];
    if (ROOT[tag]) return ROOT[tag];
    if (tag >= '02' && tag <= '25') return 'Informasi akun merchant (cadangan)';
    if (tag >= '26' && tag <= '51') return 'Informasi akun merchant';
    if (tag >= '65' && tag <= '79') return 'Tag cadangan EMVCo';
    if (tag >= '80' && tag <= '99') return 'Template tidak dipesan';
    return null;
  }
  const [parent, child] = parts;
  if (parent >= '26' && parent <= '51') return MERCHANT_ACCOUNT[child] ?? null;
  if (parent === '62') return ADDITIONAL_DATA[child] ?? null;
  if (parent === '64') return LANGUAGE[child] ?? null;
  return null;
}

/** A human reading of a node's value, where the value is itself a code. */
export function glossFor(path: string, value: string): string | null {
  if (path === '01') return INITIATION_METHOD[value] ?? null;
  if (path === '52') return MCC[value] ?? null;
  if (path === '53') return CURRENCY[value] ?? null;
  if (path === '58') return value === 'ID' ? 'Indonesia' : null;
  const parts = path.split('.');
  if (parts.length === 2 && parts[0] >= '26' && parts[0] <= '51') {
    if (parts[1] === '00') return ACQUIRER[value.toUpperCase()] ?? null;
    if (parts[1] === '03') return MERCHANT_CRITERIA[value.toUpperCase()] ?? null;
  }
  return null;
}
