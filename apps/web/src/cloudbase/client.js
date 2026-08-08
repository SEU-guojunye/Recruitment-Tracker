import cloudbase from '@cloudbase/js-sdk'

const env = import.meta.env.VITE_CLOUDBASE_ENV_ID
const region = import.meta.env.VITE_CLOUDBASE_REGION
const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY

if (!env || !region || !accessKey) {
  throw new Error('CloudBase Web 环境配置不完整')
}

export const cloudbaseApp = cloudbase.init({
  env,
  region,
  accessKey,
  auth: { detectSessionInUrl: false },
})

export const cloudbaseAuth = cloudbaseApp.auth
export const cloudbaseDatabase = cloudbaseApp.database()
