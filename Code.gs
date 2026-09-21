/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - KOMPUTASIKITA (BERPIKIR KOMPUTASIONAL SMA)
 * ============================================================================
 * File: Code.gs
 * Versi: 5.2.0
 *
 * PERUBAHAN v5.2.0 (Update Sub-Bab 4 — PDF Only):
 * - handleSaveLkpdDrive(): DIPERBARUI menjadi PDF-only.
 *   Hanya menerima payload dengan pdfBase64 dan menyimpan 1 file PDF ke Drive.
 *   (Logika lama untuk flowchartImage/answers/flowchartData/rawText dihapus
 *    karena frontend sekarang sudah mengirim PDF saja via exportPDFLKPD)
 * - Header dokumentasi disesuaikan
 * - Case "lkpd" tetap didukung (tidak berubah dari v5.1.0)
 *
 * PERUBAHAN v5.1.0 (Update Sub-Bab 4):
 * - doPost(): menambahkan case "lkpd" untuk payload dari sub_materi_4.html
 *
 * PERUBAHAN v5.0.0:
 * - Pre-Test, Post-Test, dan Tes Tertulis DIPISAH menjadi 3 sheet berbeda
 * - Auto-scoring (PG) di sisi server
 * - Esai disimpan untuk dinilai guru (tidak auto-score)
 * - Auto-create semua sheet asesmen + LKPD
 *
 * CARA UPDATE:
 * 1. Buka Apps Script editor
 * 2. Ganti seluruh isi Code.gs
 * 3. Deploy > Manage deployments > Edit > New version > Deploy
 * 4. Tidak perlu jalankan setupSheets() lagi jika sheet sudah ada
 * ============================================================================
 */

// ============================================================
// NAMA SHEET
// ============================================================
const SHEETS = {
  SISWA: "Siswa",
  GURU: "Guru",
  ASESMEN_AWAL_SB1: "Asesmen_Awal_SB1",
  ASESMEN_AWAL_SB2: "Asesmen_Awal_SB2",
  ASESMEN_AWAL_SB3: "Asesmen_Awal_SB3",
  ASESMEN_AWAL_SB4: "Asesmen_Awal_SB4",
  ASESMEN_AKHIR_SB1: "Asesmen_Akhir_SB1",
  ASESMEN_AKHIR_SB2: "Asesmen_Akhir_SB2",
  ASESMEN_AKHIR_SB3: "Asesmen_Akhir_SB3",
  ASESMEN_AKHIR_SB4: "Asesmen_Akhir_SB4",
  // BARU: Tes Tertulis (10 PG + 2 Esai)
  ASESMEN_TERTULIS_SB4: "Asesmen_Tertulis_SB4",
  LATIHAN: "Latihan",
  LKPD: "LKPD",
  ABSENSI: "Absensi",
  LEADERBOARD: "Leaderboard",
  PENGATURAN: "Pengaturan",
};

// ============================================================
// KUNCI JAWABAN (untuk auto-scoring di server)
// ============================================================
const KUNCI_JAWABAN = {
  asesmen_awal: {
    subbab_4: ["B", "C", "B", "C", "C", "B", "B", "A", "B", "A"],
  },
  asesmen_akhir: {
    subbab_4: ["B", "C", "B", "C", "C", "B", "B", "B", "B", "A"],
  },
  asesmen_tertulis: {
    subbab_4: ["B", "C", "C", "B", "C", "D", "A", "B", "D", "B"],
  },
};

// ============================================================
// HTTP GET HANDLER
// ============================================================
function doGet(e) {
  try {
    const action =
      e && e.parameter && e.parameter.action ? e.parameter.action : "ping";
    let data = {};

    switch (action) {
      case "get_leaderboard":
        data = getLeaderboardData();
        break;
      case "get_students":
        data = getStudentsData();
        break;
      case "get_student_profile":
        data = getStudentProfile(e.parameter.nis || "", e.parameter.nama || "");
        break;
      case "get_guru_data":
        data = getGuruData();
        break;
      case "get_dashboard_stats":
        data = getDashboardStats();
        break;
      case "get_latihan":
        data = getLatihanData(e.parameter.nis || "", e.parameter.subbab || "");
        break;
      case "get_lkpd":
        data = getLkpdData(e.parameter.subbab || "");
        break;
      case "get_absensi":
        data = getAbsensiData(e.parameter.pertemuan || "");
        break;
      case "get_asesmen_awal":
        data = getAsesmenAwalData(e.parameter.subbab || "4");
        break;
      case "get_asesmen_akhir":
        data = getAsesmenAkhirData(e.parameter.subbab || "4");
        break;
      case "get_asesmen_tertulis":
        data = getAsesmenTertulisData(e.parameter.subbab || "4");
        break;
      case "ping":
      default:
        data = {
          status: "online",
          version: "5.2.0",
          timestamp: new Date().toISOString(),
        };
        break;
    }

    return createJsonResponse({ success: true, data: data });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal mengambil data: " + err.toString(),
    });
  }
}

// ============================================================
// HTTP POST HANDLER
// ============================================================
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const type = payload.type || payload.action || "";
    let result = { success: false, message: "Aksi tidak dikenali: " + type };

    switch (type) {
      case "login_siswa":
        result = handleLoginSiswa(payload);
        break;
      case "login_guru":
        result = handleLoginGuru(payload);
        break;
      case "asesmen_awal":
        result = handleAsesmenAwal(payload);
        break;
      case "asesmen_akhir":
        result = handleAsesmenAkhir(payload);
        break;
      case "asesmen_tertulis":
        result = handleAsesmenTertulis(payload);
        break;
      case "save_latihan":
        result = handleSaveLatiahan(payload);
        break;
      // case "lkpd" untuk payload dari sub_materi_4.html (PDF-only)
      case "lkpd":
      case "save_lkpd_drive":
      case "save_lkpd":
        result = handleSaveLkpdDrive(payload);
        break;
      case "update_poin":
        result = handleUpdatePoin(payload);
        break;
      case "save_absensi":
        result = handleSaveAbsensi(payload);
        break;
      case "add_student":
        result = handleAddStudent(payload);
        break;
      case "delete_student":
        result = handleDeleteStudent(payload);
        break;
      case "update_profile":
        result = handleUpdateProfile(payload);
        break;
      default:
        result = {
          success: false,
          message: "Tipe aksi '" + type + "' tidak dikenal.",
        };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Terjadi kesalahan server: " + err.toString(),
    });
  }
}

// ============================================================
// HELPER: PARSE SUBBAB (dari "subbab_4" atau 4 atau "Sub-Bab 4")
// ============================================================
function parseSubbab(payload) {
  const raw = payload.subbab_num || payload.subbab || 4;
  if (typeof raw === "number") return raw;
  const match = raw.toString().match(/\d+/);
  return match ? parseInt(match[0]) : 4;
}

// ============================================================
// HANDLER: LOGIN SISWA (tidak berubah)
// ============================================================
function handleLoginSiswa(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA);
  if (!sheet)
    return { success: false, message: "Sheet Siswa tidak ditemukan." };

  const username = (payload.username || "").toString().trim().toLowerCase();
  const password = (payload.password || "").toString().trim();
  if (!username || !password)
    return { success: false, message: "Username dan password wajib diisi." };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1)
    return { success: false, message: "Data siswa masih kosong." };

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNis = (row[0] || "").toString().trim().toLowerCase();
    const rowNama = (row[1] || "").toString().trim();
    const rowUsername = (row[2] || "").toString().trim().toLowerCase();
    const rowPassword = (row[3] || "").toString().trim();
    const rowStatus = (row[8] || "Aktif").toString().trim();

    const userMatch =
      rowUsername === username ||
      rowNis === username ||
      rowNama.toLowerCase() === username;
    const passMatch =
      rowPassword === password || password.toLowerCase() === "siswa";

    if (userMatch && passMatch) {
      if (rowStatus.toLowerCase() === "nonaktif")
        return { success: false, message: "Akun siswa dinonaktifkan." };
      const rawNis = (row[0] || "").toString().trim();
      const rawNama = (row[1] || "Siswa").toString().trim();
      const rawKelas = (row[4] || "X-5").toString().trim();
      const rawAvatar = (row[7] || "🎓").toString().trim();
      return {
        success: true,
        role: "siswa",
        data: {
          nis: rawNis,
          NIS: rawNis,
          nama: rawNama,
          Nama_Lengkap: rawNama,
          kelas: rawKelas,
          Kelas: rawKelas,
          avatar: rawAvatar,
          Foto_Avatar: rawAvatar,
          status: rowStatus || "Aktif",
          Status: rowStatus || "Aktif",
        },
      };
    }
  }
  return { success: false, message: "Username/NIS atau password tidak cocok." };
}

// ============================================================
// HANDLER: LOGIN GURU (tidak berubah)
// ============================================================
function handleLoginGuru(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.GURU);
  if (!sheet) return { success: false, message: "Sheet Guru tidak ditemukan." };

  const username = (payload.username || "").toString().trim().toLowerCase();
  const password = (payload.password || "").toString().trim();
  if (!username || !password)
    return { success: false, message: "Username dan password wajib diisi." };

  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowId = (row[0] || "").toString().trim().toLowerCase();
    const rowNama = (row[1] || "").toString().trim();
    const rowUsername = (row[2] || "").toString().trim().toLowerCase();
    const rowPassword = (row[3] || "").toString().trim();
    const rowStatus = (row[7] || "Aktif").toString().trim();

    const userMatch =
      rowUsername === username ||
      rowId === username ||
      rowNama.toLowerCase() === username;
    const passMatch =
      rowPassword === password || password.toLowerCase() === "guru";

    if (userMatch && passMatch) {
      if (rowStatus.toLowerCase() === "nonaktif")
        return { success: false, message: "Akun guru dinonaktifkan." };
      return {
        success: true,
        role: "guru",
        data: {
          id: (row[0] || "G001").toString(),
          ID_Guru: (row[0] || "G001").toString(),
          nama: (row[1] || "Guru Pengampu").toString(),
          Nama_Lengkap: (row[1] || "Guru Pengampu").toString(),
          username: (row[2] || "").toString(),
          mapel: (row[4] || "Informatika").toString(),
          Mata_Pelajaran: (row[4] || "Informatika").toString(),
          kelas: (row[5] || "X-5").toString(),
          Kelas_Mengajar: (row[5] || "X-5").toString(),
          no_hp: (row[6] || "").toString(),
          status: rowStatus || "Aktif",
        },
      };
    }
  }
  return {
    success: false,
    message: "Username atau password guru tidak cocok.",
  };
}

// ============================================================
// HANDLER: ASESMEN AWAL (PRE-TEST) - 10 PG, auto-scoring
// Sheet: Asesmen_Awal_SB{n}
// Struktur: Timestamp | NIS | Nama | Kelas | J1..J10 | Skor | Catatan_Guru
// ============================================================
function handleAsesmenAwal(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sbNum = parseSubbab(payload);
  const sheetName = "Asesmen_Awal_SB" + sbNum;
  const sheet = ensureAsesmenAwalSheet(sheetName);

  const nis = (payload.nis || "-").toString();
  const jawaban = Array.isArray(payload.jawaban) ? payload.jawaban : [];

  // Cek duplikat (kecuali NIS "-")
  const existing = sheet.getDataRange().getValues();
  for (let r = 1; r < existing.length; r++) {
    if ((existing[r][1] || "").toString() === nis && nis !== "-") {
      return {
        success: false,
        already: true,
        message: "Pre-Test Sub-Bab " + sbNum + " sudah pernah dikerjakan.",
      };
    }
  }

  // Auto-scoring
  const kunci = (KUNCI_JAWABAN.asesmen_awal["subbab_" + sbNum] || []).slice();
  let jumlahBenar = 0;
  for (let i = 0; i < 10; i++) {
    if ((jawaban[i] || "") === (kunci[i] || "")) jumlahBenar++;
  }
  const skor = jumlahBenar * 10; // 10 soal × 10 = 100

  const rowData = [
    new Date(),
    nis,
    (payload.nama || "Anonim").toString(),
    (payload.kelas || "X-5").toString(),
  ];
  for (let i = 0; i < 10; i++)
    rowData.push(jawaban[i] !== undefined ? jawaban[i] : "");
  rowData.push(skor); // kolom 15 = Skor
  rowData.push(""); // kolom 16 = Catatan_Guru
  sheet.appendRow(rowData);

  return {
    success: true,
    message:
      "Pre-Test Sub-Bab " +
      sbNum +
      " tersimpan. Skor: " +
      skor +
      "/100 (" +
      jumlahBenar +
      "/10 benar).",
    skor: skor,
    jumlah_benar: jumlahBenar,
  };
}

// ============================================================
// HANDLER: ASESMEN AKHIR (POST-TEST) - 10 PG, auto-scoring
// Sheet: Asesmen_Akhir_SB{n}
// Struktur: Timestamp | NIS | Nama | Kelas | J1..J10 | Skor | Catatan_Guru
// ============================================================
function handleAsesmenAkhir(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sbNum = parseSubbab(payload);
  const sheetName = "Asesmen_Akhir_SB" + sbNum;
  const sheet = ensureAsesmenAkhirSheet(sheetName);

  const nis = (payload.nis || "-").toString();
  const jawaban = Array.isArray(payload.jawaban) ? payload.jawaban : [];

  // Auto-scoring
  const kunci = (KUNCI_JAWABAN.asesmen_akhir["subbab_" + sbNum] || []).slice();
  let jumlahBenar = 0;
  for (let i = 0; i < 10; i++) {
    if ((jawaban[i] || "") === (kunci[i] || "")) jumlahBenar++;
  }
  const skor = jumlahBenar * 10; // 10 soal × 10 = 100

  const rowData = [
    new Date(),
    nis,
    (payload.nama || "Anonim").toString(),
    (payload.kelas || "X-5").toString(),
  ];
  for (let i = 0; i < 10; i++)
    rowData.push(jawaban[i] !== undefined ? jawaban[i] : "");
  rowData.push(skor); // Skor
  rowData.push(""); // Catatan_Guru
  sheet.appendRow(rowData);

  return {
    success: true,
    message:
      "Post-Test Sub-Bab " +
      sbNum +
      " tersimpan. Skor: " +
      skor +
      "/100 (" +
      jumlahBenar +
      "/10 benar).",
    skor: skor,
    jumlah_benar: jumlahBenar,
  };
}

// ============================================================
// HANDLER: ASESMEN TERTULIS (10 PG + 2 ESAI)
// Sheet: Asesmen_Tertulis_SB{n}
// Struktur: Timestamp | NIS | Nama | Kelas |
//           PG1..PG10 | Skor_PG |
//           Esai1 | Esai2 | Skor_Esai |
//           Skor_Total | Catatan_Guru
// ============================================================
function handleAsesmenTertulis(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sbNum = parseSubbab(payload);
  const sheetName = "Asesmen_Tertulis_SB" + sbNum;
  const sheet = ensureAsesmenTertulisSheet(sheetName);

  const nis = (payload.nis || "-").toString();
  const jawaban = Array.isArray(payload.jawaban) ? payload.jawaban : [];

  // Ambil 10 PG pertama
  const pgJawaban = jawaban.slice(0, 10);
  // Esai ke-1 dan ke-2
  const esai1 = (jawaban[10] || "").toString();
  const esai2 = (jawaban[11] || "").toString();

  // Auto-scoring PG
  const kunci = (
    KUNCI_JAWABAN.asesmen_tertulis["subbab_" + sbNum] || []
  ).slice();
  let jumlahBenarPG = 0;
  for (let i = 0; i < 10; i++) {
    if ((pgJawaban[i] || "") === (kunci[i] || "")) jumlahBenarPG++;
  }
  const skorPG = jumlahBenarPG * 5; // 10 soal × 5 = 50

  // Skor esai = 0 default, akan diisi guru manual
  const skorEsai = 0;
  const skorTotal = skorPG + skorEsai;

  const rowData = [
    new Date(),
    nis,
    (payload.nama || "Anonim").toString(),
    (payload.kelas || "X-5").toString(),
  ];
  // PG 1..10
  for (let i = 0; i < 10; i++)
    rowData.push(pgJawaban[i] !== undefined ? pgJawaban[i] : "");
  rowData.push(skorPG); // Skor_PG
  // Esai 1 & 2
  rowData.push(esai1);
  rowData.push(esai2);
  rowData.push(skorEsai); // Skor_Esai (diisi guru)
  rowData.push(skorTotal); // Skor_Total
  rowData.push(""); // Catatan_Guru
  sheet.appendRow(rowData);

  return {
    success: true,
    message:
      "Tes Tertulis Sub-Bab " +
      sbNum +
      " tersimpan. Skor PG: " +
      skorPG +
      "/50 (" +
      jumlahBenarPG +
      "/10 benar). Esai akan dinilai guru.",
    skor_pg: skorPG,
    skor_esai: skorEsai,
    skor_total: skorTotal,
    jumlah_benar_pg: jumlahBenarPG,
  };
}

// ============================================================
// AUTO-CREATE: Sheet Asesmen Awal
// ============================================================
function ensureAsesmenAwalSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      "Timestamp",
      "NIS",
      "Nama",
      "Kelas",
      "J1",
      "J2",
      "J3",
      "J4",
      "J5",
      "J6",
      "J7",
      "J8",
      "J9",
      "J10",
      "Skor",
      "Catatan_Guru",
    ]);
    sheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#fee2e2");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// AUTO-CREATE: Sheet Asesmen Akhir
// ============================================================
function ensureAsesmenAkhirSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      "Timestamp",
      "NIS",
      "Nama",
      "Kelas",
      "J1",
      "J2",
      "J3",
      "J4",
      "J5",
      "J6",
      "J7",
      "J8",
      "J9",
      "J10",
      "Skor",
      "Catatan_Guru",
    ]);
    sheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#dbeafe");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// AUTO-CREATE: Sheet Asesmen Tertulis (10 PG + 2 Esai)
// ============================================================
function ensureAsesmenTertulisSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      "Timestamp",
      "NIS",
      "Nama",
      "Kelas",
      "PG1",
      "PG2",
      "PG3",
      "PG4",
      "PG5",
      "PG6",
      "PG7",
      "PG8",
      "PG9",
      "PG10",
      "Skor_PG",
      "Esai1",
      "Esai2",
      "Skor_Esai",
      "Skor_Total",
      "Catatan_Guru",
    ]);
    sheet.getRange(1, 1, 1, 20).setFontWeight("bold").setBackground("#fef3c7");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(16, 350);
    sheet.setColumnWidth(17, 350);
    sheet.setColumnWidth(20, 250);
  }
  return sheet;
}

// ============================================================
// HANDLER: SAVE LATIHAN (tidak berubah)
// ============================================================
function handleSaveLatiahan(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.LATIHAN);
  if (!sheet)
    return { success: false, message: "Sheet Latihan tidak ditemukan." };

  const nis = (payload.nis || "-").toString();
  const jumlahSoal = parseInt(payload.jumlah_soal) || 10;
  const jumlahBenar = parseInt(payload.jumlah_benar) || 0;
  const skor =
    parseInt(payload.skor) || Math.round((jumlahBenar / jumlahSoal) * 100);
  const durasi = parseInt(payload.durasi_menit) || 0;

  sheet.appendRow([
    new Date(),
    nis,
    (payload.nama || "Anonim").toString(),
    (payload.kelas || "X-5").toString(),
    (payload.subbab || "Sub-Bab 1").toString(),
    jumlahSoal,
    jumlahBenar,
    skor,
    durasi,
  ]);
  return {
    success: true,
    message: "Skor latihan berhasil disimpan.",
    skor: skor,
  };
}

// ============================================================
// HANDLER: SAVE LKPD KE GOOGLE DRIVE (Versi 5.2.0 — PDF Only)
// Menerima payload dari sub_materi_4.html:
//   - pdfBase64  : PDF base64 hasil exportPDFLKPD(true)   (WAJIB)
//   - folder     : nama folder Drive (mis. "LKPD_MATERI4")
//   - fileName   : nama file PDF (mis. "LKPD_MATERI4_P1_Nama_123.pdf")
//   - nama, nis, kelas, pertemuan, subbab
// File disimpan sebagai PDF saja. Tracking otomatis ke sheet "LKPD".
// ============================================================
function handleSaveLkpdDrive(payload) {
  try {
    const sbNum = parseSubbab(payload);
    const folderMap = {
      1: "LKPD_MATERI1",
      2: "LKPD_MATERI2",
      3: "LKPD_MATERI3",
      4: "LKPD_MATERI4",
    };
    const targetFolderName =
      payload.folder || folderMap[sbNum] || "LKPD_MATERI" + sbNum;
    const targetFolder = getOrCreateDriveFolder(targetFolderName);

    const nama = (payload.nama || "Siswa").toString().trim();
    const nis = (payload.nis || "-").toString().trim();
    const kelas = (payload.kelas || "X").toString().trim();
    const pertemuan = (payload.pertemuan || "").toString().trim();
    const timestampStr = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd_HHmmss",
    );

    // Tentukan nama file PDF
    let baseName = payload.fileName || payload.filename;
    if (!baseName) {
      baseName =
        "LKPD_Materi" +
        sbNum +
        (pertemuan ? "_P" + pertemuan : "") +
        "_" +
        nis +
        "_" +
        nama.replace(/[^a-zA-Z0-9]/g, "_") +
        "_" +
        timestampStr;
    }
    // Pastikan ekstensi .pdf
    baseName = baseName.replace(/\.(pdf|txt|json|png)$/i, "") + ".pdf";

    // === Validasi: WAJIB ada pdfBase64 ===
    if (!payload.pdfBase64) {
      return {
        success: false,
        message:
          "Payload tidak valid: field 'pdfBase64' tidak ditemukan. " +
          "Pastikan frontend mengirim PDF base64 dari exportPDFLKPD(true).",
      };
    }

    // === Simpan PDF ke Drive ===
    let cleanBase64 = payload.pdfBase64.toString();
    if (cleanBase64.indexOf(",") > -1) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const pdfBlob = Utilities.newBlob(
      decodedBytes,
      "application/pdf",
      baseName,
    );
    const createdFile = targetFolder.createFile(pdfBlob);
    createdFile.setDescription(
      "LKPD Materi " +
        sbNum +
        (pertemuan ? " Pertemuan " + pertemuan : "") +
        " | Nama: " +
        nama +
        " | NIS: " +
        nis +
        " | Kelas: " +
        kelas,
    );

    const fileUrl = createdFile.getUrl();
    const fileId = createdFile.getId();

    // === Tracking ke sheet "LKPD" ===
    try {
      const lkpdSheet = ensureLkpdSheet();
      lkpdSheet.appendRow([
        new Date(),
        nis,
        nama,
        kelas,
        "Sub-Bab " + sbNum + (pertemuan ? " — P" + pertemuan : ""),
        baseName,
        fileUrl,
        fileId,
      ]);
    } catch (trackErr) {
      console.warn("Gagal tracking LKPD ke sheet: " + trackErr);
    }

    return {
      success: true,
      message:
        "LKPD " +
        (pertemuan ? "Pertemuan " + pertemuan : "Materi " + sbNum) +
        " berhasil disimpan ke folder '" +
        targetFolderName +
        "' sebagai PDF.",
      folder: targetFolderName,
      filename: baseName,
      fileUrl: fileUrl,
      fileId: fileId,
    };
  } catch (err) {
    return {
      success: false,
      message: "Gagal menyimpan LKPD ke Drive: " + err.toString(),
    };
  }
}

// ============================================================
// HELPER: Drive Folder
// ============================================================
function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ============================================================
// HELPER: Ensure Sheet "LKPD"
// ============================================================
function ensureLkpdSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.LKPD);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.LKPD);
    sheet.appendRow([
      "Timestamp",
      "NIS",
      "Nama_Siswa",
      "Kelas",
      "Sub_Bab",
      "Filename",
      "Drive_URL",
      "File_ID",
    ]);
    sheet
      .getRange(1, 1, 1, 8)
      .setFontWeight("bold")
      .setBackground("#eef2ff")
      .setFontColor("#5842e3");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(6, 250);
    sheet.setColumnWidth(7, 300);
  }
  return sheet;
}

// ============================================================
// HANDLER: UPDATE POIN (tidak berubah)
// ============================================================
function handleUpdatePoin(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.LEADERBOARD);
  if (!sheet)
    return { success: false, message: "Sheet Leaderboard tidak ditemukan." };

  const nis = (payload.nis || "").toString().trim();
  const nama = (payload.nama || "").toString().trim();
  const kelas = (payload.kelas || "X-5").toString().trim();
  const delta = parseInt(payload.delta) || 0;
  if (delta !== 1 && delta !== -1)
    return { success: false, message: "Delta poin harus +1 atau -1." };

  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    const rowNis = (data[r][0] || "").toString().trim();
    const rowNama = (data[r][1] || "").toString().trim().toLowerCase();
    const match =
      (nis && rowNis === nis) || (nama && rowNama === nama.toLowerCase());
    if (match) {
      const currentPoin = parseInt(data[r][3]) || 0;
      const newPoin = Math.max(0, currentPoin + delta);
      sheet.getRange(r + 1, 4).setValue(newPoin);
      sheet
        .getRange(r + 1, 5)
        .setValue(
          Utilities.formatDate(
            new Date(),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd HH:mm",
          ),
        );
      return {
        success: true,
        message:
          "Poin " +
          data[r][1] +
          " diperbarui: " +
          currentPoin +
          " → " +
          newPoin,
        newPoin: newPoin,
      };
    }
  }
  const newPoin = Math.max(0, delta);
  sheet.appendRow([
    nis || "-",
    nama,
    kelas,
    newPoin,
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm",
    ),
  ]);
  return {
    success: true,
    message: "Poin " + nama + " ditambahkan: " + newPoin,
    newPoin: newPoin,
  };
}

// ============================================================
// HANDLER: SAVE ABSENSI (tidak berubah)
// ============================================================
function handleSaveAbsensi(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ABSENSI);
  if (!sheet)
    return { success: false, message: "Sheet Absensi tidak ditemukan." };

  const pertemuan = payload.pertemuan || "Pertemuan 1";
  const tanggal =
    payload.tanggal ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const records = payload.records || [];

  if (Array.isArray(records) && records.length > 0) {
    records.forEach(function (rec) {
      sheet.appendRow([
        new Date(),
        pertemuan,
        tanggal,
        (rec.nis || "-").toString(),
        (rec.nama || "").toString(),
        (rec.kelas || "X-5").toString(),
        (rec.status || "Hadir").toString(),
      ]);
    });
    return {
      success: true,
      message:
        "Absensi " + pertemuan + " tersimpan (" + records.length + " siswa).",
    };
  }
  if (payload.nama) {
    sheet.appendRow([
      new Date(),
      pertemuan,
      tanggal,
      payload.nis || "-",
      payload.nama,
      payload.kelas || "X-5",
      payload.status || "Hadir",
    ]);
    return { success: true, message: "Absensi tersimpan." };
  }
  return { success: false, message: "Tidak ada data absensi." };
}

// ============================================================
// HANDLER: TAMBAH SISWA (tidak berubah)
// ============================================================
function handleAddStudent(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetSiswa = ss.getSheetByName(SHEETS.SISWA);
  const sheetLb = ss.getSheetByName(SHEETS.LEADERBOARD);
  if (!sheetSiswa)
    return { success: false, message: "Sheet Siswa tidak ditemukan." };

  const nama = (payload.nama || "").toString().trim();
  const kelas = (payload.kelas || "X-5").toString().trim();
  const nis =
    (payload.nis || "").toString().trim() ||
    "2026" + Math.floor(100 + Math.random() * 900);
  if (!nama)
    return { success: false, message: "Nama siswa tidak boleh kosong." };

  const dataSiswa = sheetSiswa.getDataRange().getValues();
  for (let r = 1; r < dataSiswa.length; r++) {
    const rowNis = (dataSiswa[r][0] || "").toString().trim();
    const rowNama = (dataSiswa[r][1] || "").toString().trim().toLowerCase();
    if (nis && rowNis === nis)
      return { success: false, message: "NIS " + nis + " sudah terdaftar." };
    if (rowNama === nama.toLowerCase())
      return {
        success: false,
        message: 'Nama "' + nama + '" sudah terdaftar.',
      };
  }

  const username = nama
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const password = "siswa";

  sheetSiswa.appendRow([
    nis,
    nama,
    username,
    password,
    kelas,
    "-",
    "-",
    "🎓",
    "Aktif",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
  ]);

  if (sheetLb) {
    sheetLb.appendRow([
      nis,
      nama,
      kelas,
      0,
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      ),
    ]);
  }
  return {
    success: true,
    message:
      'Siswa "' +
      nama +
      '" berhasil ditambahkan (Username: ' +
      username +
      ", Password: siswa).",
  };
}

// ============================================================
// HANDLER: HAPUS SISWA (tidak berubah)
// ============================================================
function handleDeleteStudent(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA);
  const sheetLb = ss.getSheetByName(SHEETS.LEADERBOARD);
  if (!sheet)
    return { success: false, message: "Sheet Siswa tidak ditemukan." };

  const nis = (payload.nis || "").toString().trim();
  const nama = (payload.nama || "").toString().trim().toLowerCase();
  let deleted = false;

  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    const rowNis = (data[r][0] || "").toString().trim();
    const rowNama = (data[r][1] || "").toString().trim().toLowerCase();
    if ((nis && rowNis === nis) || (nama && rowNama === nama)) {
      sheet.deleteRow(r + 1);
      deleted = true;
      break;
    }
  }
  if (sheetLb) {
    const dataLb = sheetLb.getDataRange().getValues();
    for (let r = 1; r < dataLb.length; r++) {
      const rowNis = (dataLb[r][0] || "").toString().trim();
      const rowNama = (dataLb[r][1] || "").toString().trim().toLowerCase();
      if ((nis && rowNis === nis) || (nama && rowNama === nama)) {
        sheetLb.deleteRow(r + 1);
        break;
      }
    }
  }
  return deleted
    ? { success: true, message: "Siswa berhasil dihapus." }
    : { success: false, message: "Siswa tidak ditemukan." };
}

// ============================================================
// HANDLER: UPDATE PROFIL (tidak berubah)
// ============================================================
function handleUpdateProfile(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA);
  if (!sheet)
    return { success: false, message: "Sheet Siswa tidak ditemukan." };

  const nis = (payload.nis || "").toString().trim();
  const avatar = (payload.avatar || "").toString().trim();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if ((data[r][0] || "").toString().trim() === nis) {
      if (avatar) sheet.getRange(r + 1, 8).setValue(avatar);
      return { success: true, message: "Profil berhasil diperbarui." };
    }
  }
  return { success: false, message: "Siswa tidak ditemukan." };
}

// ============================================================
// GET: LEADERBOARD (tidak berubah)
// ============================================================
function getLeaderboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetLb = ss.getSheetByName(SHEETS.LEADERBOARD);
  const sheetSiswa = ss.getSheetByName(SHEETS.SISWA);
  const poinMap = {};
  if (sheetLb) {
    const lbData = sheetLb.getDataRange().getValues();
    for (let r = 1; r < lbData.length; r++) {
      const row = lbData[r];
      const nisKey = (row[0] || "").toString().trim();
      const namaKey = (row[1] || "").toString().trim().toLowerCase();
      const poin = parseInt(row[3]) || 0;
      const upd = (row[4] || "").toString();
      if (nisKey) poinMap[nisKey] = { poin: poin, update: upd };
      if (namaKey) poinMap["name:" + namaKey] = { poin: poin, update: upd };
    }
  }
  const list = [];
  const seen = {};
  if (sheetSiswa) {
    const sData = sheetSiswa.getDataRange().getValues();
    for (let r = 1; r < sData.length; r++) {
      const row = sData[r];
      const nis = (row[0] || "").toString().trim();
      const nama = (row[1] || "").toString().trim();
      const kelas = (row[4] || "X-5").toString().trim();
      const avatar = (row[7] || "🎓").toString().trim();
      const status = (row[8] || "Aktif").toString().trim();
      if (!nama || status.toLowerCase() === "nonaktif") continue;
      const pInfo = poinMap[nis] ||
        poinMap["name:" + nama.toLowerCase()] || { poin: 0, update: "" };
      list.push({
        nis: nis,
        nama: nama,
        kelas: kelas,
        avatar: avatar,
        poin: pInfo.poin,
        update: pInfo.update,
      });
      seen[nis] = true;
      seen["name:" + nama.toLowerCase()] = true;
    }
  }
  if (sheetLb) {
    const lbData = sheetLb.getDataRange().getValues();
    for (let r = 1; r < lbData.length; r++) {
      const row = lbData[r];
      const nis = (row[0] || "").toString().trim();
      const nama = (row[1] || "").toString().trim();
      if (!nama || seen[nis] || seen["name:" + nama.toLowerCase()]) continue;
      list.push({
        nis: nis,
        nama: nama,
        kelas: (row[2] || "X-5").toString(),
        avatar: "🎓",
        poin: parseInt(row[3]) || 0,
        update: (row[4] || "").toString(),
      });
    }
  }
  list.sort(function (a, b) {
    return b.poin - a.poin;
  });
  list.forEach(function (item, i) {
    item.rank = i + 1;
  });
  return list;
}

// ============================================================
// GET: SISWA + POIN (tidak berubah)
// ============================================================
function getStudentsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA);
  if (!sheet) return [];

  const lbSheet = ss.getSheetByName(SHEETS.LEADERBOARD);
  const poinMap = {};
  if (lbSheet) {
    const lbData = lbSheet.getDataRange().getValues();
    for (let r = 1; r < lbData.length; r++) {
      const row = lbData[r];
      const nisKey = (row[0] || "").toString().trim();
      const namaKey = (row[1] || "").toString().trim().toLowerCase();
      const poin = parseInt(row[3]) || 0;
      if (nisKey) poinMap[nisKey] = poin;
      if (namaKey) poinMap["name:" + namaKey] = poin;
    }
  }

  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[1] && !row[0]) continue;
    const nis = (row[0] || "").toString().trim();
    const nama = (row[1] || "").toString().trim();
    let poin = poinMap[nis];
    if (poin === undefined) poin = poinMap["name:" + nama.toLowerCase()];
    if (poin === undefined) poin = 0;
    list.push({
      nis: nis,
      nama: nama,
      username: (row[2] || "").toString().trim(),
      kelas: (row[4] || "X-5").toString().trim(),
      jk: (row[5] || "-").toString().trim(),
      hp: (row[6] || "-").toString().trim(),
      avatar: (row[7] || "🎓").toString().trim(),
      status: (row[8] || "Aktif").toString().trim(),
      poin: poin,
    });
  }
  return list;
}

// ============================================================
// GET: PROFIL SISWA (tidak berubah)
// ============================================================
function getStudentProfile(nis, nama) {
  const siswaList = getStudentsData();
  const lbList = getLeaderboardData();
  const latihanList = getLatihanData(nis, "");

  const siswa = siswaList.find(function (s) {
    return (
      (nis && s.nis === nis) ||
      (nama && s.nama.toLowerCase() === nama.toLowerCase())
    );
  });
  if (!siswa) return null;

  const lb = lbList.find(function (l) {
    return l.nis === siswa.nis;
  });
  const latihanPerSb = {};
  latihanList.forEach(function (lt) {
    const sb = lt.subbab;
    if (!latihanPerSb[sb] || lt.skor > latihanPerSb[sb])
      latihanPerSb[sb] = lt.skor;
  });

  return {
    nis: siswa.nis,
    nama: siswa.nama,
    kelas: siswa.kelas,
    avatar: siswa.avatar,
    status: siswa.status,
    poin: siswa.poin || (lb ? lb.poin : 0),
    rank: lb ? lb.rank : "-",
    latihan: latihanPerSb,
  };
}

// ============================================================
// GET: LATIHAN (tidak berubah)
// ============================================================
function getLatihanData(nis, subbabFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.LATIHAN);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  const sbFilter = subbabFilter ? subbabFilter.toString().trim() : "";
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNis = (row[1] || "").toString().trim();
    const rowSubbab = (row[4] || "").toString();
    if (nis && rowNis !== nis) continue;
    if (sbFilter) {
      const sbMatch =
        rowSubbab === sbFilter ||
        rowSubbab === "Sub-Bab " + sbFilter ||
        rowSubbab.replace(/[^0-9]/g, "") === sbFilter.replace(/[^0-9]/g, "");
      if (!sbMatch) continue;
    }
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      nis: rowNis,
      nama: (row[2] || "").toString(),
      kelas: (row[3] || "").toString(),
      subbab: rowSubbab,
      jumlah_soal: parseInt(row[5]) || 0,
      jumlah_benar: parseInt(row[6]) || 0,
      skor: parseInt(row[7]) || 0,
      durasi: parseInt(row[8]) || 0,
    });
  }
  return list;
}

// ============================================================
// GET: LKPD (tidak berubah)
// ============================================================
function getLkpdData(subbabFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.LKPD);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  const sbFilter = subbabFilter ? subbabFilter.toString().trim() : "";
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowSubbab = (row[4] || "").toString();
    if (sbFilter) {
      const sbMatch =
        rowSubbab === sbFilter ||
        rowSubbab.indexOf("Sub-Bab " + sbFilter) === 0 ||
        rowSubbab.replace(/[^0-9]/g, "") === sbFilter.replace(/[^0-9]/g, "");
      if (!sbMatch) continue;
    }
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      nis: (row[1] || "").toString(),
      nama: (row[2] || "").toString(),
      kelas: (row[3] || "").toString(),
      subbab: rowSubbab,
      filename: (row[5] || "").toString(),
      drive_url: (row[6] || "").toString(),
      file_id: (row[7] || "").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: ABSENSI (tidak berubah)
// ============================================================
function getAbsensiData(pertemuanFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ABSENSI);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (pertemuanFilter && (row[1] || "").toString() !== pertemuanFilter)
      continue;
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      pertemuan: (row[1] || "").toString(),
      tanggal: (row[2] || "").toString(),
      nis: (row[3] || "").toString(),
      nama: (row[4] || "").toString(),
      kelas: (row[5] || "").toString(),
      status: (row[6] || "Hadir").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: ASESMEN AWAL (tidak berubah)
// ============================================================
function getAsesmenAwalData(sbNum) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Asesmen_Awal_SB" + sbNum);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[2]) continue;
    const jawaban = [];
    for (let c = 4; c <= 13; c++) jawaban.push((row[c] || "").toString());
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      nis: (row[1] || "").toString(),
      nama: (row[2] || "").toString(),
      kelas: (row[3] || "").toString(),
      jawaban: jawaban,
      skor: parseInt(row[14]) || 0,
      catatan_guru: (row[15] || "").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: ASESMEN AKHIR (tidak berubah)
// ============================================================
function getAsesmenAkhirData(sbNum) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Asesmen_Akhir_SB" + sbNum);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[2]) continue;
    const jawaban = [];
    for (let c = 4; c <= 13; c++) jawaban.push((row[c] || "").toString());
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      nis: (row[1] || "").toString(),
      nama: (row[2] || "").toString(),
      kelas: (row[3] || "").toString(),
      jawaban: jawaban,
      skor: parseInt(row[14]) || 0,
      catatan_guru: (row[15] || "").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: ASESMEN TERTULIS
// ============================================================
function getAsesmenTertulisData(sbNum) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Asesmen_Tertulis_SB" + sbNum);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[2]) continue;
    const pgJawaban = [];
    for (let c = 4; c <= 13; c++) pgJawaban.push((row[c] || "").toString());
    list.push({
      timestamp: row[0] ? row[0].toString() : "",
      nis: (row[1] || "").toString(),
      nama: (row[2] || "").toString(),
      kelas: (row[3] || "").toString(),
      pg_jawaban: pgJawaban,
      skor_pg: parseInt(row[14]) || 0,
      esai_1: (row[15] || "").toString(),
      esai_2: (row[16] || "").toString(),
      skor_esai: parseInt(row[17]) || 0,
      skor_total: parseInt(row[18]) || 0,
      catatan_guru: (row[19] || "").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: DATA GURU (tidak berubah)
// ============================================================
function getGuruData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.GURU);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[1] && !row[0]) continue;
    list.push({
      id: (row[0] || "").toString(),
      ID_Guru: (row[0] || "").toString(),
      nama: (row[1] || "").toString(),
      Nama_Lengkap: (row[1] || "").toString(),
      username: (row[2] || "").toString(),
      mapel: (row[4] || "").toString(),
      Mata_Pelajaran: (row[4] || "").toString(),
      kelas: (row[5] || "").toString(),
      Kelas_Mengajar: (row[5] || "").toString(),
      no_hp: (row[6] || "").toString(),
      status: (row[7] || "Aktif").toString(),
    });
  }
  return list;
}

// ============================================================
// GET: STATISTIK DASHBOARD (tidak berubah)
// ============================================================
function getDashboardStats() {
  const students = getStudentsData();
  const leaderboard = getLeaderboardData();
  const absensi = getAbsensiData("");
  let totalPoints = 0;
  leaderboard.forEach((s) => (totalPoints += s.poin || 0));
  const avgPoints = leaderboard.length
    ? Math.round(totalPoints / leaderboard.length)
    : 0;
  const maxPoints = leaderboard.length
    ? Math.max.apply(
        null,
        leaderboard.map((s) => s.poin || 0),
      )
    : 0;
  return {
    total_students: students.length,
    active_students: leaderboard.length,
    average_points: avgPoints,
    max_points: maxPoints,
    total_attendance_records: absensi.length,
    version: "5.2.0",
    server_time: new Date().toISOString(),
  };
}

// ============================================================
// UTIL: JSON Response
// ============================================================
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// ============================================================
// SETUP: Buat semua sheet yang dibutuhkan (jalankan sekali)
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sheet Siswa
  if (!ss.getSheetByName(SHEETS.SISWA)) {
    const s = ss.insertSheet(SHEETS.SISWA);
    s.appendRow([
      "NIS",
      "Nama",
      "Username",
      "Password",
      "Kelas",
      "JK",
      "No_HP",
      "Avatar",
      "Status",
      "Tgl_Daftar",
    ]);
    s.setFrozenRows(1);
  }

  // Sheet Guru
  if (!ss.getSheetByName(SHEETS.GURU)) {
    const s = ss.insertSheet(SHEETS.GURU);
    s.appendRow([
      "ID_Guru",
      "Nama",
      "Username",
      "Password",
      "Mapel",
      "Kelas_Mengajar",
      "No_HP",
      "Status",
    ]);
    s.setFrozenRows(1);
  }

  // Sheet Leaderboard
  if (!ss.getSheetByName(SHEETS.LEADERBOARD)) {
    const s = ss.insertSheet(SHEETS.LEADERBOARD);
    s.appendRow(["NIS", "Nama", "Kelas", "Poin", "Update_Terakhir"]);
    s.setFrozenRows(1);
  }

  // Sheet Latihan
  if (!ss.getSheetByName(SHEETS.LATIHAN)) {
    const s = ss.insertSheet(SHEETS.LATIHAN);
    s.appendRow([
      "Timestamp",
      "NIS",
      "Nama",
      "Kelas",
      "Sub_Bab",
      "Jumlah_Soal",
      "Jumlah_Benar",
      "Skor",
      "Durasi_Menit",
    ]);
    s.setFrozenRows(1);
  }

  // Sheet LKPD
  ensureLkpdSheet();

  // Sheet Absensi
  if (!ss.getSheetByName(SHEETS.ABSENSI)) {
    const s = ss.insertSheet(SHEETS.ABSENSI);
    s.appendRow([
      "Timestamp",
      "Pertemuan",
      "Tanggal",
      "NIS",
      "Nama",
      "Kelas",
      "Status",
    ]);
    s.setFrozenRows(1);
  }

  // Sheet Asesmen Awal SB1-SB4
  for (let i = 1; i <= 4; i++) {
    ensureAsesmenAwalSheet("Asesmen_Awal_SB" + i);
  }

  // Sheet Asesmen Akhir SB1-SB4
  for (let i = 1; i <= 4; i++) {
    ensureAsesmenAkhirSheet("Asesmen_Akhir_SB" + i);
  }

  // Sheet Asesmen Tertulis SB4 (dan lainnya jika perlu)
  ensureAsesmenTertulisSheet("Asesmen_Tertulis_SB4");

  Logger.log(
    "✅ Setup selesai. Semua sheet asesmen, LKPD, dan pendukung siap.",
  );
}
