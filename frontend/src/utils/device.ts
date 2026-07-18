import { DEVICE_ID_STORAGE_KEY } from '../constants';

// 로그인 없이 이 브라우저의 구매 기록을 식별하는 익명 ID
export function getDeviceId(): string {
    const saved = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
}
