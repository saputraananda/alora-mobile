import { academyPool, mainPool, myWaschenPool } from '../../db/pool.js';
import { computeSkillScore } from './skillScore.js';

// Yang dinilai hanya karyawan Waschen (sama dengan WASCHEN_COMPANY_ID di waschen-mobile).
const WASCHEN_COMPANY_ID = 5;

/** Cabang tempat karyawan login ditugaskan sebagai LO. Penugasan dikelola HR di superapp. */
async function getLoOutletIds(employeeId) {
  const [rows] = await academyPool.query(
    'SELECT outlet_id FROM mst_lo_assignment WHERE employee_id = ? AND is_active = 1',
    [employeeId]
  );
  return rows.map((r) => r.outlet_id);
}

/** Karyawan Waschen aktif di cabang tertentu. Cabang ada di mst_role (DB my_waschen). */
async function getOutletEmployees(outletIds) {
  if (!outletIds.length) return [];
  const [roles] = await myWaschenPool.query(
    'SELECT employee_id, outlet_id, role FROM mst_role WHERE outlet_id IN (?) ORDER BY is_leader DESC, outlet_id ASC',
    [outletIds]
  );
  const roleByEmployee = new Map();
  for (const role of roles) if (!roleByEmployee.has(role.employee_id)) roleByEmployee.set(role.employee_id, role);
  if (!roleByEmployee.size) return [];

  const [employees] = await mainPool.query(
    `SELECT employee_id, full_name FROM mst_employee
     WHERE employee_id IN (?) AND company_id = ? AND is_deleted = 0 AND exit_date IS NULL
     ORDER BY full_name`,
    [[...roleByEmployee.keys()], WASCHEN_COMPANY_ID]
  );
  return employees.map((e) => ({ ...e, ...roleByEmployee.get(e.employee_id) }));
}

async function requireLo(req, res) {
  const outletIds = await getLoOutletIds(req.employeeId);
  if (!outletIds.length) {
    res.status(403).json({ success: false, message: 'Menu ini hanya untuk LO yang ditugaskan HR' });
    return null;
  }
  return outletIds;
}

export const getAccess = async (req, res) => {
  try {
    const outletIds = await getLoOutletIds(req.employeeId);
    const [outlets] = outletIds.length
      ? await mainPool.query('SELECT id, name FROM mst_outlet WHERE id IN (?) ORDER BY name', [outletIds])
      : [[]];
    res.json({ success: true, data: { is_lo: outletIds.length > 0, outlets } });
  } catch (err) {
    console.error('[skill-matrix] getAccess error:', err);
    res.status(500).json({ success: false, message: 'Gagal memeriksa akses skill matrix' });
  }
};

/** Semua posisi aktif, termasuk yang indikatornya belum diisi HR, beserta jumlah orangnya di cabang LO. */
export const getPositions = async (req, res) => {
  try {
    const outletIds = await requireLo(req, res);
    if (!outletIds) return;
    const employees = await getOutletEmployees(outletIds);
    const [positions] = await academyPool.query(
      'SELECT id, name, role_key FROM mst_sm_position WHERE is_active = 1 ORDER BY sort_order, name'
    );
    const [categories] = await academyPool.query(
      'SELECT id, position_id, name, weight FROM mst_sm_category WHERE is_active = 1 ORDER BY sort_order, id'
    );
    const [indicators] = await academyPool.query(
      'SELECT id, category_id, name FROM mst_sm_indicator WHERE is_active = 1 ORDER BY sort_order, id'
    );
    res.json({
      success: true,
      data: positions.map((p) => {
        const own = categories
          .filter((c) => c.position_id === p.id)
          .map((c) => ({ ...c, weight: Number(c.weight), indicators: indicators.filter((i) => i.category_id === c.id) }));
        return {
          ...p,
          categories: own,
          ready: own.some((c) => c.indicators.length > 0),
          // Posisi tanpa bagian menampilkan semua nama, jadi jumlahnya semua orang di cabang.
          people_count: employees.filter((e) => !p.role_key || e.role === p.role_key).length,
        };
      }),
    });
  } catch (err) {
    console.error('[skill-matrix] getPositions error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat posisi' });
  }
};

/**
 * Karyawan di cabang LO beserta penilaian terakhir di posisi yang dipilih.
 * scope=role (default): hanya bagian yang terhubung ke posisi, dibaca langsung dari mst_role.
 * scope=all, atau posisi tanpa bagian: semua nama di cabang.
 */
export const getEmployees = async (req, res) => {
  try {
    const outletIds = await requireLo(req, res);
    if (!outletIds) return;

    const positionId = Number(req.query.position_id) || 0;
    const [[position]] = positionId
      ? await academyPool.query('SELECT role_key FROM mst_sm_position WHERE id = ?', [positionId])
      : [[]];
    const roleKey = req.query.scope === 'all' ? null : position?.role_key ?? null;
    const employees = (await getOutletEmployees(outletIds)).filter((e) => !roleKey || e.role === roleKey);
    const [latest] = employees.length && positionId
      ? await academyPool.query(
          `SELECT a.employee_id, a.score, a.star, a.assessed_at
           FROM tr_sm_assessment a
           JOIN (SELECT employee_id, MAX(id) AS id FROM tr_sm_assessment
                 WHERE position_id = ? AND employee_id IN (?) GROUP BY employee_id) last ON last.id = a.id`,
          [positionId, employees.map((e) => e.employee_id)]
        )
      : [[]];
    const latestByEmployee = new Map(latest.map((l) => [l.employee_id, l]));

    res.json({
      success: true,
      data: employees.map((e) => ({ ...e, last_assessment: latestByEmployee.get(e.employee_id) ?? null })),
    });
  } catch (err) {
    console.error('[skill-matrix] getEmployees error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat karyawan' });
  }
};

/** Penilaian terakhir karyawan di satu posisi, untuk mengisi form. Bisa dari LO mana pun di cabang itu. */
export const getLatestAssessment = async (req, res) => {
  try {
    const outletIds = await requireLo(req, res);
    if (!outletIds) return;

    const employeeId = Number(req.query.employee_id);
    const employees = await getOutletEmployees(outletIds);
    if (!employees.some((e) => e.employee_id === employeeId)) {
      return res.status(403).json({ success: false, message: 'Karyawan ini bukan dari cabangmu' });
    }

    const [[assessment]] = await academyPool.query(
      'SELECT id, note, score, star, assessed_at FROM tr_sm_assessment WHERE employee_id = ? AND position_id = ? ORDER BY id DESC LIMIT 1',
      [employeeId, req.query.position_id]
    );
    const [details] = assessment
      ? await academyPool.query('SELECT indicator_id, score FROM tr_sm_assessment_detail WHERE assessment_id = ?', [assessment.id])
      : [[]];
    res.json({ success: true, data: assessment ? { ...assessment, details } : null });
  } catch (err) {
    console.error('[skill-matrix] getLatestAssessment error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat penilaian' });
  }
};

/** Setiap simpan = penilaian baru. Rapor memakai yang terbaru per karyawan per posisi. */
export const saveAssessment = async (req, res) => {
  const employeeId = Number(req.body.employee_id);
  const positionId = Number(req.body.position_id);
  const note = String(req.body.note ?? '').trim().slice(0, 2000) || null;

  let conn;
  try {
    const outletIds = await requireLo(req, res);
    if (!outletIds) return;

    const employee = (await getOutletEmployees(outletIds)).find((e) => e.employee_id === employeeId);
    if (!employee) return res.status(403).json({ success: false, message: 'Karyawan ini bukan dari cabangmu' });

    const [categories] = await academyPool.query(
      `SELECT c.id, c.weight FROM mst_sm_category c
       JOIN mst_sm_position p ON p.id = c.position_id AND p.is_active = 1
       WHERE c.position_id = ? AND c.is_active = 1`,
      [positionId]
    );
    const [indicators] = categories.length
      ? await academyPool.query('SELECT id, category_id FROM mst_sm_indicator WHERE category_id IN (?) AND is_active = 1', [
          categories.map((c) => c.id),
        ])
      : [[]];
    if (!indicators.length) return res.status(400).json({ success: false, message: 'Posisi belum punya indikator' });

    const submitted = new Map((Array.isArray(req.body.scores) ? req.body.scores : []).map((s) => [Number(s.indicator_id), Number(s.score)]));
    if (indicators.some((i) => ![1, 2, 3, 4].includes(submitted.get(i.id)))) {
      return res.status(400).json({ success: false, message: 'Semua indikator wajib dinilai 1 sampai 4' });
    }

    const { score, star } = computeSkillScore(
      categories.map((c) => ({
        weight: c.weight,
        scores: indicators.filter((i) => i.category_id === c.id).map((i) => submitted.get(i.id)),
      }))
    );
    const weightByCategory = new Map(categories.map((c) => [c.id, c.weight]));

    conn = await academyPool.getConnection();
    await conn.beginTransaction();
    const [inserted] = await conn.query(
      `INSERT INTO tr_sm_assessment (employee_id, position_id, outlet_id, assessor_employee_id, note, score, star, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, positionId, employee.outlet_id, req.employeeId, note, score, star, req.employeeId]
    );
    for (const indicator of indicators) {
      await conn.query(
        `INSERT INTO tr_sm_assessment_detail (assessment_id, indicator_id, score, category_weight, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [inserted.insertId, indicator.id, submitted.get(indicator.id), weightByCategory.get(indicator.category_id), req.employeeId]
      );
    }
    await conn.commit();
    res.json({ success: true, data: { score, star } });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[skill-matrix] saveAssessment error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan penilaian' });
  } finally {
    if (conn) conn.release();
  }
};
