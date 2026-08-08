import { cloudbaseAuth } from './client.js'

function assertNoAuthError(result, fallbackMessage) {
  if (result?.error) {
    const error = new Error(result.error.message || fallbackMessage)
    error.code = result.error.code
    throw error
  }
  return result?.data
}

export function getSessionUserId(session) {
  const user = session?.user
  if (user?.is_anonymous === true || session?.is_anonymous === true) return null
  return user?.id || user?.uid || session?.user_id || session?.uid || session?.sub || null
}

export class CloudBaseAuthService {
  async signInWithPassword({ username, password }) {
    const data = assertNoAuthError(
      await cloudbaseAuth.signInWithPassword({ username, password }),
      'CloudBase 登录失败',
    )
    const session = data?.session || (await this.getSession())
    const userId = getSessionUserId(session)
    if (!session || !userId) throw new Error('登录成功但没有取得真实 CloudBase Session')
    return { session, userId }
  }

  async getSession() {
    const data = assertNoAuthError(await cloudbaseAuth.getSession(), '读取登录状态失败')
    return data?.session || null
  }

  async requireSession() {
    const session = await this.getSession()
    const userId = getSessionUserId(session)
    if (!session || !userId) throw new Error('当前没有真实 CloudBase Session')
    return { session, userId }
  }

  async signOut() {
    assertNoAuthError(await cloudbaseAuth.signOut(), '退出登录失败')
  }
}
