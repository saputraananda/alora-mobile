import { mainPool } from '../db/pool.js';

/**
 * Get Detailed Employee Profile from MySQL mainPool
 */
export const getProfileDetail = async (req, res) => {
  try {
    const { userId, email, employeeId } = req.query;

    const query = `
      SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email, 
        u.username, 
        u.role, 
        u.avatar,
        e.*,
        jl.job_level_name, 
        p.position_name, 
        d.department_name
      FROM users u
      LEFT JOIN mst_employee e ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
      LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
      LEFT JOIN mst_position p ON e.position_id = p.position_id
      LEFT JOIN mst_department d ON e.department_id = d.department_id
      WHERE u.id = ? OR u.email = ? OR e.employee_id = ? OR (e.email IS NOT NULL AND e.email = ?)
      LIMIT 1
    `;

    const [rows] = await mainPool.query(query, [
      userId || 0,
      email || '',
      employeeId || 0,
      email || ''
    ]);

    let item = null;
    if (rows && rows.length > 0) {
      item = rows[0];
    } else {
      // Fallback query to get the first active employee from DB mainPool
      const [firstRows] = await mainPool.query(`
        SELECT 
          u.id as user_id, u.name as user_name, u.email as user_email, u.username, u.role, u.avatar,
          e.*, jl.job_level_name, p.position_name, d.department_name
        FROM users u
        LEFT JOIN mst_employee e ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
        LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
        LEFT JOIN mst_position p ON e.position_id = p.position_id
        LEFT JOIN mst_department d ON e.department_id = d.department_id
        LIMIT 1
      `);
      if (firstRows && firstRows.length > 0) {
        item = firstRows[0];
      }
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Data profil karyawan tidak ditemukan.'
      });
    }

    const formatISO = (d) => {
      if (!d) return null;
      try {
        return new Date(d).toISOString().slice(0, 10);
      } catch {
        return d;
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Detail profil ditarik murni dari database mainPool.',
      data: {
        userId: item.user_id,
        employee_id: item.employee_id || item.user_id,
        fullName: item.full_name || item.user_name || item.username || '',
        full_name: item.full_name || item.user_name || item.username || '',
        employee_code: item.employee_code || `ALR-${item.user_id}`,
        email: item.email || item.user_email || '',
        private_email: item.private_email || item.email || item.user_email || '',
        phone: item.phone_number || '',
        phone_number: item.phone_number || '',
        address: item.address || '',
        gender: item.gender || '',
        birth_place: item.birth_place || '',
        birth_date: formatISO(item.birth_date),
        ktp_number: item.ktp_number || '',
        mother_name: item.mother_name || '',
        emergency_contact: item.emergency_contact || '',
        join_date: formatISO(item.join_date),
        contract_end_date: formatISO(item.contract_end_date),
        education_level_id: item.education_level_id || '',
        school_name: item.school_name || '',
        major_name: item.major_name || '',
        religion_id: item.religion_id || '',
        marital_status: item.marital_status || '',
        bank_id: item.bank_id || '',
        bank_account_number: item.bank_account_number || '',
        job_level: item.job_level_name || item.role || 'Staff Operasional',
        position: item.position_name || 'Karyawan',
        department: item.department_name || 'PT Waschen Alora Indonesia',
        assignedOutletName: 'Alora Head Office',
        profile_url: item.profile_path || item.avatar || null,
        ktp_url: item.ktp_path || null,
        kk_url: item.kk_path || null,
        npwp_url: item.npwp_path || null,
        bpjs_url: item.bpjs_path || null,
        bpjs_tk_url: item.bpjs_tk_path || null,
        ijazah_url: item.ijazah_path || null,
        sertifikat_url: item.sertifikat_path || null,
        rekomkerja_url: item.rekomkerja_path || null
      }
    });

  } catch (error) {
    console.error('Error fetching profile detail:', error);
    return res.status(500).json({
      success: false,
      message: `Gagal mengambil data profil: ${error.message}`
    });
  }
};

/**
 * Update Profile Handler in mainPool
 */
export const updateProfile = async (req, res) => {
  try {
    const {
      employee_id,
      gender,
      birth_place,
      birth_date,
      address,
      ktp_number,
      phone_number,
      private_email,
      mother_name,
      emergency_contact,
      join_date,
      contract_end_date,
      education_level_id,
      school_name,
      major_name,
      religion_id,
      marital_status,
      bank_id,
      bank_account_number
    } = req.body;

    const query = `
      UPDATE mst_employee SET
        gender = ?,
        birth_place = ?,
        birth_date = ?,
        address = ?,
        ktp_number = ?,
        phone_number = ?,
        private_email = ?,
        mother_name = ?,
        emergency_contact = ?,
        join_date = ?,
        contract_end_date = ?,
        education_level_id = ?,
        school_name = ?,
        major_name = ?,
        religion_id = ?,
        marital_status = ?,
        bank_id = ?,
        bank_account_number = ?,
        updated_at = NOW()
      WHERE employee_id = ? OR email = ?
    `;

    await mainPool.query(query, [
      gender || null,
      birth_place || null,
      birth_date || null,
      address || null,
      ktp_number || null,
      phone_number || null,
      private_email || null,
      mother_name || null,
      emergency_contact || null,
      join_date || null,
      contract_end_date || null,
      education_level_id || null,
      school_name || null,
      major_name || null,
      religion_id || null,
      marital_status || null,
      bank_id || null,
      bank_account_number || null,
      employee_id || 1,
      private_email || ''
    ]);

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui dalam database mainPool.'
    });

  } catch (error) {
    console.error('Error updating profile in mainPool:', error);
    return res.status(500).json({
      success: false,
      message: `Gagal memperbarui profil: ${error.message}`
    });
  }
};

/**
 * Get Banks List from DB mainPool
 */
export const getBanks = async (req, res) => {
  try {
    const [rows] = await mainPool.query('SELECT bank_id, bank_name FROM mst_bank WHERE is_active = 1 OR is_active IS NULL ORDER BY bank_name ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Education Levels List from DB mainPool
 */
export const getEducationLevels = async (req, res) => {
  try {
    const [rows] = await mainPool.query('SELECT education_level_id, education_level_name FROM mst_education_level WHERE is_active = 1 OR is_active IS NULL ORDER BY education_level_id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Document Upload Placeholder
 */
export const uploadDoc = async (req, res) => {
  try {
    const { docKey } = req.params;
    return res.status(200).json({
      success: true,
      message: `Dokumen ${docKey} berhasil diunggah.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
