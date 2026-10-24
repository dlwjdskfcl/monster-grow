/**
 * 환경 설정 — 빌드할 때 정해짐 (.github/workflows/deploy.yml 의 환경 변수)
 *   VITE_ENV     : local | staging | prod
 *   VITE_API_URL : 그 환경의 GAS 웹 앱 주소 (공개 값. 비밀 값은 절대 넣지 않음)
 * 브라우저 저장 키는 모두 'mkg_<env>_' 로 시작 → 같은 github.io 주소를 쓰는 다른 사이트(jammanbo 등)와 겹치지 않음
 */
export type Env = 'local' | 'staging' | 'prod';
const env = (import.meta.env.VITE_ENV as Env) || 'local';
export const ENV: Env = env;
export const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';
export const KEY_PREFIX = `mkg_${env}_`;
export const APP_VERSION = '0.1.0';
