const DEFAULT_TIMEOUT_MS = 15000;

export async function postJson(apiUrl, payload, options = {}) {
    if (!apiUrl) throw new Error('API URL belum dikonfigurasi');

    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error('Respons API bukan JSON yang valid');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        return data;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Request API timeout setelah ' + Math.round(timeoutMs / 1000) + ' detik');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
