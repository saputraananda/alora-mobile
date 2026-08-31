import { mainPool } from '../db/pool.js';

export async function listActiveBroadcasts(req, res) {
  try {
    const [rows] = await mainPool.query(
      `SELECT id, title, description, type, starts_at, expires_at,
              creator_name, created_at,
              TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_left
       FROM tr_broadcast
       WHERE is_active = 1
         AND starts_at  <= NOW()
         AND expires_at  > NOW()
       ORDER BY
         FIELD(type, 'urgent','warning','info','success'),
         created_at DESC`,
    );

    return res.json({
      success: true,
      data: { broadcasts: rows },
    });
  } catch (err) {
    console.error('[broadcast] listActiveBroadcasts:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat pengumuman',
    });
  }
}
