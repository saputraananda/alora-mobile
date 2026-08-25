import 'dotenv/config'
import { defineConfig } from 'prisma/config'

function aloraMobileUrl() {
  const user = process.env.DB_ALORA_MOBILE_USER
  const pass = process.env.DB_ALORA_MOBILE_PASS
  const host = process.env.DB_ALORA_MOBILE_HOST
  const port = process.env.DB_ALORA_MOBILE_PORT || '3306'
  const name = process.env.DB_ALORA_MOBILE_NAME

  if (!host || !user || !pass || !name) {
    throw new Error('Missing DB_ALORA_MOBILE_* environment variables')
  }

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}?connect_timeout=60`
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: aloraMobileUrl(),
  },
})
