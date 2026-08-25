import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

let prisma = null

export default function getAloraMobilePrisma() {
  if (!prisma) {
    const adapter = new PrismaMariaDb({
      host: process.env.DB_ALORA_MOBILE_HOST,
      port: Number(process.env.DB_ALORA_MOBILE_PORT || 3306),
      user: process.env.DB_ALORA_MOBILE_USER,
      password: process.env.DB_ALORA_MOBILE_PASS,
      database: process.env.DB_ALORA_MOBILE_NAME,
      connectionLimit: 5,
    })
    prisma = new PrismaClient({ adapter })
  }

  return prisma
}
