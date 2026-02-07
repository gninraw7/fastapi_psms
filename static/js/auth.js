/**
 * ===================================
 * 인증 관리 모듈 (auth.js)
 * JWT 토큰 기반 인증 관리
 * ===================================
 */

const AUTH = {
    // Storage Keys (sessionStorage 사용 - 브라우저 닫으면 자동 삭제)
    STORAGE_KEYS: {
        SERVER_URL: 'psms_server_url',
        ACCESS_TOKEN: 'psms_access_token',
        REFRESH_TOKEN: 'psms_refresh_token',
        USER_INFO: 'psms_user_info',
        COMPANY_CD: 'psms_company_cd'
    },

    /**
     * 서버 URL 저장
     */
    setServerUrl(url) {
        sessionStorage.setItem(this.STORAGE_KEYS.SERVER_URL, url);
    },

    /**
     * 서버 URL 가져오기
     */
    getServerUrl() {
        return sessionStorage.getItem(this.STORAGE_KEYS.SERVER_URL);
    },

    /**
     * 토큰 저장
     */
    setTokens(accessToken, refreshToken) {
        sessionStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        sessionStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    },

    /**
     * 액세스 토큰 가져오기
     */
    getAccessToken() {
        return sessionStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    },

    /**
     * 리프레시 토큰 가져오기
     */
    getRefreshToken() {
        return sessionStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    },

    /**
     * 사용자 정보 저장
     */
    setUserInfo(userInfo) {
        sessionStorage.setItem(this.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
    },

    /**
     * 사용자 정보 가져오기
     */
    getUserInfo() {
        const userInfoStr = sessionStorage.getItem(this.STORAGE_KEYS.USER_INFO);
        return userInfoStr ? JSON.parse(userInfoStr) : null;
    },

    /**
     * 회사 코드 저장
     */
    setCompanyCd(companyCd) {
        if (companyCd) {
            sessionStorage.setItem(this.STORAGE_KEYS.COMPANY_CD, companyCd);
        }
    },

    /**
     * 회사 코드 가져오기
     */
    getCompanyCd() {
        return sessionStorage.getItem(this.STORAGE_KEYS.COMPANY_CD);
    },

    /**
     * 모든 인증 정보 삭제
     */
    clearAuth() {
        sessionStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
        sessionStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
        sessionStorage.removeItem(this.STORAGE_KEYS.USER_INFO);
        // 서버 URL은 유지 (다음 로그인 시 편의성)
        // sessionStorage.removeItem(this.STORAGE_KEYS.SERVER_URL);
    },

    /**
     * 로그인 여부 확인
     */
    isAuthenticated() {
        return !!this.getAccessToken();
    },

    /**
     * API 요청 (인증 포함)
     */
    async apiRequest(endpoint, options = {}) {
        const serverUrl = this.getServerUrl();
        if (!serverUrl) {
            throw new Error('서버 주소가 설정되지 않았습니다.');
        }

        const url = `${serverUrl}${endpoint}`;
        const token = this.getAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // 401 에러면 토큰 갱신 시도
            if (response.status === 401 && token) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // 토큰 갱신 성공 시 재시도
                    headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers
                    });
                    return await this.handleResponse(retryResponse);
                } else {
                    // 토큰 갱신 실패 시 로그아웃
                    this.logout();
                    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
                }
            }

            return await this.handleResponse(response);
        } catch (error) {
            console.error('API 요청 실패:', error);
            throw error;
        }
    },

    /**
     * 응답 처리
     */
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || `HTTP Error: ${response.status}`);
            }
            
            return data;
        } else {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return await response.text();
        }
    },

    /**
     * 서버 연결 테스트
     */
    async testConnection(serverUrl) {
        try {
            const response = await fetch(`${serverUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return { success: true, message: '서버 연결 성공' };
            } else {
                return { success: false, message: '서버 연결 실패' };
            }
        } catch (error) {
            console.error('서버 연결 테스트 실패:', error);
            return { success: false, message: '서버에 연결할 수 없습니다.' };
        }
    },

    /**
     * 로그인
     */
    async login(loginId, password) {
        try {
            const companyCd =
                this.getCompanyCd() ||
                (window.COMPANY_CONFIG && window.COMPANY_CONFIG.DEFAULT_COMPANY_CD) ||
                'TESTCOMP';
            const data = await this.apiRequest('/api/v1/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login_id: loginId,
                    password: password,
                    company_cd: companyCd
                })
            });

            // 토큰 저장
            this.setTokens(data.access_token, data.refresh_token);

            // 사용자 정보 가져오기
            const userInfo = await this.getMe();
            this.setUserInfo(userInfo);
            if (userInfo && userInfo.company_cd) {
                this.setCompanyCd(userInfo.company_cd);
            }

            return { success: true, user: userInfo };
        } catch (error) {
            console.error('로그인 실패:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * 현재 사용자 정보 가져오기
     */
    async getMe() {
        try {
            return await this.apiRequest('/api/v1/auth/me', {
                method: 'GET'
            });
        } catch (error) {
            console.error('사용자 정보 조회 실패:', error);
            throw error;
        }
    },

    /**
     * 토큰 갱신
     */
    async refreshToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            return false;
        }

        try {
            const data = await this.apiRequest('/api/v1/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    refresh_token: refreshToken
                })
            });

            this.setTokens(data.access_token, data.refresh_token);
            return true;
        } catch (error) {
            console.error('토큰 갱신 실패:', error);
            return false;
        }
    },

    /**
     * 회사 전환 (새 토큰 발급)
     */
    async switchCompany(companyCd) {
        if (!companyCd) {
            throw new Error('회사 코드가 필요합니다.');
        }

        const data = await this.apiRequest('/api/v1/auth/switch-company', {
            method: 'POST',
            body: JSON.stringify({ company_cd: companyCd })
        });

        this.setTokens(data.access_token, data.refresh_token);
        const userInfo = await this.getMe();
        this.setUserInfo(userInfo);
        if (userInfo && userInfo.company_cd) {
            this.setCompanyCd(userInfo.company_cd);
        }
        return userInfo;
    },

    /**
     * 로그아웃
     */
    async logout() {
        try {
            await this.apiRequest('/api/v1/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('로그아웃 요청 실패:', error);
        } finally {
            this.clearAuth();
            window.location.href = '/';  // 루트 경로로 리디렉션 (login.html이 표시됨)
        }
    },

    /**
     * 자동 로그인 시도
     */
    async tryAutoLogin() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            const userInfo = await this.getMe();
            this.setUserInfo(userInfo);
            return true;
        } catch (error) {
            console.error('자동 로그인 실패:', error);
            this.clearAuth();
            return false;
        }
    }
};

// 전역으로 사용할 수 있도록 window 객체에 추가
window.AUTH = AUTH;
