import { mainPool, aloraMobilePool } from '../../db/pool.js';
import { getApproverContext } from '../../shared/utils/approvalAccess.js';
import {
  todayDateStringJakarta,
  toDateOnlyJakarta,
  isOffDay,
  buildPeriodRange,
  getCutoffPeriodForToday,
} from '../../shared/utils/workScheduleRules.js';

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function formatHM(minutesVal) {
  const totalM = Math.max(0, Math.round(Number(minutesVal) || 0));
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return {
    hours: h,
    minutes: m,
    label: `${h}j ${String(m).padStart(2, '0')}m`,
  };
}

function hoursToMinutes(hoursVal) {
  return Math.round((Number(hoursVal) || 0) * 60);
}

function getInitials(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * GET /api/team/summary
 * Query params optional:
 * - month (1-12)
 * - year (e.g. 2026)
 */
export const getTeamSummary = async (req, res) => {
  try {
    const spvEmployeeId = req.employeeId;
    if (!spvEmployeeId) {
      return res.status(403).json({ success: false, message: 'Akun tidak terdaftar sebagai karyawan' });
    }

    // 1. Validasi akses SPV / Approver
    const approverCtx = await getApproverContext(spvEmployeeId);
    if (!approverCtx?.isSpv && !approverCtx?.canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Akses khusus Supervisor atau Leader tim',
      });
    }

    // 2. Ambil data profil SPV & departemen
    const [spvRows] = await mainPool.query(
      `SELECT e.employee_id, e.employee_code, e.full_name, e.department_id, e.position_id,
              d.department_name, p.position_name, jl.job_level_name, u.avatar
       FROM mst_employee e
       LEFT JOIN mst_department d ON e.department_id = d.department_id
       LEFT JOIN mst_position p ON e.position_id = p.position_id
       LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
       LEFT JOIN users u ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
       WHERE e.employee_id = ? AND e.is_deleted = 0 AND e.exit_date IS NULL
       LIMIT 1`,
      [spvEmployeeId]
    );

    const spvData = spvRows[0] || {};
    const departmentId = approverCtx.departmentId ?? spvData.department_id;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Departemen supervisor tidak ditemukan',
      });
    }

    // 3. Tentukan rentang periode Cut Off (26 bulan lalu s.d. 25 bulan berjalan)
    const today = todayDateStringJakarta();
    const nowPeriod = getCutoffPeriodForToday() || { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    const cutoffMonth = Number(req.query.cutoffMonth || req.query.month || nowPeriod.month);
    const cutoffYear = Number(req.query.cutoffYear || req.query.year || nowPeriod.year);

    const range = buildPeriodRange(cutoffMonth, cutoffYear);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: 'Periode cut off tidak valid',
      });
    }
    const { periodStart, periodEnd } = range;

    const prevMonth = cutoffMonth === 1 ? 12 : cutoffMonth - 1;
    const prevYear = cutoffMonth === 1 ? cutoffYear - 1 : cutoffYear;
    const prevMonthShort = MONTH_NAMES_SHORT[prevMonth - 1];
    const monthShort = MONTH_NAMES_SHORT[cutoffMonth - 1];
    const rangeLabel = prevYear !== cutoffYear
      ? `26 ${prevMonthShort} ${prevYear} – 25 ${monthShort} ${cutoffYear}`
      : `26 ${prevMonthShort} – 25 ${monthShort} ${cutoffYear}`;
    const monthLabel = `Cut Off ${MONTH_NAMES_ID[cutoffMonth - 1]} ${cutoffYear}`;

    // 4. Ambil seluruh anggota tim dalam departemen (kecuali diri sendiri)
    const [members] = await mainPool.query(
      `SELECT e.employee_id, e.employee_code, e.full_name, e.department_id, e.position_id,
              p.position_name, jl.job_level_name, u.avatar
       FROM mst_employee e
       LEFT JOIN mst_position p ON e.position_id = p.position_id
       LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
       LEFT JOIN users u ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
       WHERE e.department_id = ? AND e.employee_id != ? AND e.is_deleted = 0 AND e.exit_date IS NULL
       ORDER BY e.full_name ASC`,
      [departmentId, spvEmployeeId]
    );

    const memberIds = members.map((m) => Number(m.employee_id));

    if (memberIds.length === 0) {
      return res.json({
        success: true,
        data: {
          supervisor: {
            name: spvData.full_name || approverCtx.fullName || 'Supervisor',
            role_title: spvData.job_level_name || 'Supervisor',
            employee_code: spvData.employee_code || '',
            department_name: spvData.department_name || 'Operasional',
            avatar: spvData.avatar || null,
            initials: getInitials(spvData.full_name),
          },
          period: {
            cutoff_month: cutoffMonth,
            cutoff_year: cutoffYear,
            period_start: periodStart,
            period_end: periodEnd,
            month: cutoffMonth,
            year: cutoffYear,
            month_label: monthLabel,
            range_label: rangeLabel,
          },
          team_summary: {
            total_members: 0,
            telat: { duration_label: '0j 00m', count: 0, total_minutes: 0 },
            izin: { duration_label: '0j 00m', count: 0, total_minutes: 0 },
            lembur: { duration_label: '0j 00m', count: 0, total_minutes: 0 },
            replace_off: { days: 0, days_label: '0 hari', sub_label: 'WOD' },
          },
          members: [],
        },
      });
    }

    const placeholders = memberIds.map(() => '?').join(',');

    // 5. Query presensi seluruh anggota tim dalam periode
    const [attendanceRows] = await aloraMobilePool.query(
      `SELECT id, employee_id, attendance_date, clock_in, clock_out,
              attendance_mode, late_minutes, late_status, late_category
       FROM tr_worker_attendance
       WHERE employee_id IN (${placeholders})
         AND attendance_date >= ? AND attendance_date <= ?`,
      [...memberIds, periodStart, periodEnd]
    );

    // 6. Query izin / cuti disetujui dalam periode
    const [leaveRows] = await aloraMobilePool.query(
      `SELECT id, employee_id, leave_type, duration_type, start_date, end_date,
              funding_ro_hours, funding_overtime_hours, funding_unpaid_hours,
              leave_duration_hours
       FROM tr_worker_leaves
       WHERE employee_id IN (${placeholders})
         AND status = 'disetujui'
         AND start_date <= ? AND end_date >= ?`,
      [...memberIds, periodEnd, periodStart]
    );

    // 7. Query lembur disetujui dalam periode
    const [lemburRows] = await aloraMobilePool.query(
      `SELECT id, employee_id, work_date, duration_hours, compensation_type
       FROM tr_worker_lembur_ro
       WHERE employee_id IN (${placeholders})
         AND status = 'disetujui'
         AND work_date >= ? AND work_date <= ?`,
      [...memberIds, periodStart, periodEnd]
    );

    // 8. Query presensi hari ini untuk menentukan status badge
    const [todayAttendanceRows] = await aloraMobilePool.query(
      `SELECT id, employee_id, clock_in, clock_out, attendance_mode
       FROM tr_worker_attendance
       WHERE employee_id IN (${placeholders})
         AND attendance_date = ?`,
      [...memberIds, today]
    );

    const todayAttMap = new Map();
    for (const r of todayAttendanceRows) {
      todayAttMap.set(Number(r.employee_id), r);
    }

    // Status libur hari ini
    const isTodayOff = await isOffDay(today);

    // 9. Agregasi per anggota tim
    let teamTotalLateMinutes = 0;
    let teamTotalLateCount = 0;
    let teamTotalIzinMinutes = 0;
    let teamTotalIzinCount = 0;
    let teamTotalLemburMinutes = 0;
    let teamTotalLemburCount = 0;
    let teamTotalReplaceOffDays = 0;

    const formattedMembers = members.map((emp) => {
      const eId = Number(emp.employee_id);

      // --- Filter data anggota ---
      const empAtt = attendanceRows.filter((r) => Number(r.employee_id) === eId);
      const empLeaves = leaveRows.filter((r) => Number(r.employee_id) === eId);
      const empLembur = lemburRows.filter((r) => Number(r.employee_id) === eId);

      // A. TELAT
      let lateMinutes = 0;
      let lateCount = 0;
      for (const a of empAtt) {
        const m = Number(a.late_minutes) || 0;
        if (m > 0) {
          lateMinutes += m;
          lateCount += 1;
        }
      }

      // B. IZIN (akumulasi jam izin & frekuensi)
      let izinMinutes = 0;
      let izinCount = 0;
      let replaceOffDays = 0;

      for (const l of empLeaves) {
        const ltype = String(l.leave_type || '').toLowerCase();
        const durationHours = Number(l.leave_duration_hours) || 0;
        const roCovered = Number(l.funding_ro_hours || 0);

        if (roCovered > 0) {
          replaceOffDays += 1;
        }

        if (ltype === 'izin') {
          izinCount += 1;
          const hrs = durationHours > 0 ? durationHours : 8;
          izinMinutes += hoursToMinutes(hrs);
        }
      }

      // Hitung juga hari WOD dari presensi sebagai Replace Off
      for (const a of empAtt) {
        if (a.attendance_mode === 'wod') {
          replaceOffDays += 1;
        }
      }

      // C. LEMBUR
      let lemburMinutes = 0;
      let lemburCount = empLembur.length;
      for (const l of empLembur) {
        const h = Number(l.duration_hours) || 0;
        lemburMinutes += hoursToMinutes(h);
      }

      // Akumulasi ke Total Tim
      teamTotalLateMinutes += lateMinutes;
      teamTotalLateCount += lateCount;
      teamTotalIzinMinutes += izinMinutes;
      teamTotalIzinCount += izinCount;
      teamTotalLemburMinutes += lemburMinutes;
      teamTotalLemburCount += lemburCount;
      teamTotalReplaceOffDays += replaceOffDays;

      // D. STATUS HARI INI
      const todayAtt = todayAttMap.get(eId);
      let statusToday = {
        code: 'belum_clock_in',
        label: 'Belum clock in',
        badge_variant: 'warning', // amber/orange
      };

      if (todayAtt?.clock_in) {
        statusToday = {
          code: 'hadir',
          label: 'Hadir',
          badge_variant: 'success', // emerald/green
        };
      } else {
        // Cek apakah ada izin/sakit/cuti hari ini
        const activeLeaveToday = empLeaves.find((l) => {
          const s = toDateOnlyJakarta(l.start_date);
          const e = toDateOnlyJakarta(l.end_date);
          return today >= s && today <= e;
        });

        if (activeLeaveToday) {
          const lt = String(activeLeaveToday.leave_type || '').toLowerCase();
          if (lt === 'izin') {
            statusToday = { code: 'izin', label: 'Izin hari ini', badge_variant: 'info' };
          } else if (lt === 'sakit') {
            statusToday = { code: 'sakit', label: 'Sakit', badge_variant: 'danger' };
          } else if (lt === 'cuti') {
            statusToday = { code: 'cuti', label: 'Cuti', badge_variant: 'purple' };
          } else {
            statusToday = { code: lt, label: `${activeLeaveToday.leave_type}`, badge_variant: 'info' };
          }
        } else if (isTodayOff) {
          statusToday = { code: 'libur', label: 'Libur', badge_variant: 'neutral' };
        }
      }

      return {
        employee_id: eId,
        name: emp.full_name,
        employee_code: emp.employee_code || `WAI-${eId}`,
        role_title: emp.position_name || emp.job_level_name || 'Staff',
        avatar: emp.avatar || null,
        initials: getInitials(emp.full_name),
        today_status: statusToday,
        metrics: {
          telat: {
            duration_label: formatHM(lateMinutes).label,
            count: lateCount,
            total_minutes: lateMinutes,
          },
          izin: {
            duration_label: formatHM(izinMinutes).label,
            count: izinCount,
            total_minutes: izinMinutes,
          },
          lembur: {
            duration_label: formatHM(lemburMinutes).label,
            count: lemburCount,
            total_minutes: lemburMinutes,
          },
          replace_off: {
            days: replaceOffDays,
            days_label: `${replaceOffDays} hari`,
            sub_label: 'WOD',
          },
        },
      };
    });

    return res.json({
      success: true,
      data: {
        supervisor: {
          name: spvData.full_name || approverCtx.fullName || 'Supervisor',
          role_title: spvData.job_level_name || 'Supervisor',
          employee_code: spvData.employee_code || '',
          department_name: spvData.department_name || 'Operasional',
          avatar: spvData.avatar || null,
          initials: getInitials(spvData.full_name),
        },
        period: {
          cutoff_month: cutoffMonth,
          cutoff_year: cutoffYear,
          period_start: periodStart,
          period_end: periodEnd,
          month: cutoffMonth,
          year: cutoffYear,
          month_label: monthLabel,
          range_label: rangeLabel,
        },
        team_summary: {
          total_members: formattedMembers.length,
          telat: {
            duration_label: formatHM(teamTotalLateMinutes).label,
            count: teamTotalLateCount,
            total_minutes: teamTotalLateMinutes,
          },
          izin: {
            duration_label: formatHM(teamTotalIzinMinutes).label,
            count: teamTotalIzinCount,
            total_minutes: teamTotalIzinMinutes,
          },
          lembur: {
            duration_label: formatHM(teamTotalLemburMinutes).label,
            count: teamTotalLemburCount,
            total_minutes: teamTotalLemburMinutes,
          },
          replace_off: {
            days: teamTotalReplaceOffDays,
            days_label: `${teamTotalReplaceOffDays} hari`,
            sub_label: 'WOD',
          },
        },
        members: formattedMembers,
      },
    });
  } catch (error) {
    console.error('[team] getTeamSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat ringkasan data tim',
      error: error.message,
    });
  }
};
