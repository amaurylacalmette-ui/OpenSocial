/**
 * Pinterest — real integration via API v5.
 * Auth: access token (boards:read, pins:write) + the board to pin into.
 * Publish: POST /v5/pins with an image_url media source — pins are image-only.
 */
import { apiJson, requireFields, PlatformError, type Credentials, type DeliveryResult, type PlatformAdapter, type VerifiedProfile } from './shared';

const V5 = 'https://api.pinterest.com/v5';

function auth(creds: Credentials): string {
  requireFields(creds, 'Pinterest', ['accessToken']);
  return `Bearer ${creds.accessToken.trim()}`;
}

async function resolveBoard(creds: Credentials): Promise<string> {
  requireFields(creds, 'Pinterest', ['boardId']);
  const boards = await apiJson<{ items?: { id: string; name?: string; url?: string }[] }>(`${V5}/boards`, {
    headers: { Authorization: auth(creds) },
  });
  const wanted = creds.boardId.trim();
  const found = boards.items?.find((b) => b.id === wanted || b.url?.endsWith(`/${wanted}`));
  if (!found) throw new PlatformError(`Board "${wanted}" was not found on this Pinterest account.`);
  return found.id;
}

export const pinterest: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const h = { Authorization: auth(creds) };
    const me = await apiJson<{ username?: string; full_name?: string }>(`${V5}/user_account`, { headers: h });
    if (!me.username) throw new PlatformError('Pinterest did not return a username — check the token scopes.');
    await resolveBoard(creds); // live check that the configured board exists
    return {
      username: me.username,
      displayName: me.full_name || me.username,
      followers: null,
      remoteId: me.username,
      remoteUrl: `https://www.pinterest.com/${me.username}/`,
      credentials: { accessToken: creds.accessToken.trim(), boardId: creds.boardId.trim() },
    };
  },

  async deliver(creds, text, mediaUrl): Promise<DeliveryResult> {
    if (!mediaUrl) {
      throw new PlatformError('Pins require an image: attach an image (URL) to the post, or remove Pinterest from this post\u2019s targets.');
    }
    const boardId = await resolveBoard(creds);
    const pin = await apiJson<{ id: string }>(`${V5}/pins`, {
      method: 'POST',
      headers: { Authorization: auth(creds), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        description: text,
        media_source: { source_type: 'image_url', url: mediaUrl },
      }),
    });
    return { remoteId: pin.id, remoteUrl: `https://www.pinterest.com/pin/${pin.id}/` };
  },
};
