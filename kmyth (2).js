// kmyth.js - كميث المتطور (يدور فعلاً ويجاوب زي ENI)

class KmythBrain {
    constructor() {
        this.memory = this.loadMemory();
        this.proxies = [
            "https://api.allorigins.win/raw?url=",
            "https://corsproxy.io/?",
            "https://api.codetabs.com/v1/proxy?quest="
        ];
        this.currentProxy = 0;
    }

    loadMemory() {
        try {
            const saved = localStorage.getItem('kmyth_memory_v2');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    }

    saveMemory() {
        try {
            localStorage.setItem('kmyth_memory_v2', JSON.stringify(this.memory));
        } catch {}
    }

    addMemory(query, answer, sources) {
        this.memory.push({ query, answer, sources, time: new Date().toISOString() });
        if (this.memory.length > 100) this.memory = this.memory.slice(-100);
        this.saveMemory();
    }

    checkMemory(query) {
        for (let i = this.memory.length - 1; i >= 0; i--) {
            const mem = this.memory[i];
            if (mem.query.toLowerCase().includes(query.toLowerCase()) ||
                query.toLowerCase().includes(mem.query.toLowerCase())) {
                return mem;
            }
        }
        return null;
    }

    getProxy() {
        const proxy = this.proxies[this.currentProxy];
        this.currentProxy = (this.currentProxy + 1) % this.proxies.length;
        return proxy;
    }

    // ========== البحث في Wikipedia ==========
    async searchWikipedia(query, lang = 'ar') {
        try {
            const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.extract && data.extract.length > 50) {
                    return {
                        title: data.title,
                        content: data.extract,
                        url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${data.title}`,
                        source: `Wikipedia (${lang})`,
                        type: 'wiki'
                    };
                }
            }
        } catch (e) { console.log("Wiki error:", e); }
        return null;
    }

    async searchWikipediaFull(query) {
        try {
            // جرب العربي الأول
            let result = await this.searchWikipedia(query, 'ar');
            if (result) return result;

            // جرب الإنجليزي
            result = await this.searchWikipedia(query, 'en');
            if (result) return result;

            // جرب البحث في Wikipedia
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.query?.search?.length > 0) {
                const title = data.query.search[0].title;
                return await this.searchWikipedia(title, 'en');
            }
        } catch (e) { console.log("Wiki full error:", e); }
        return null;
    }

    // ========== البحث في DuckDuckGo ==========
    async searchDuckDuckGo(query) {
        try {
            // DuckDuckGo Instant Answer API (JSON - CORS enabled!)
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const proxyUrl = this.getProxy() + encodeURIComponent(url);

            const response = await fetch(proxyUrl);
            const text = await response.text();

            // DuckDuckGo بيرجع JSONP مش JSON عادي
            // نستخدم HTML version بدلاً
            return await this.searchDuckDuckGoHTML(query);
        } catch (e) { 
            console.log("DDG error:", e);
            return await this.searchDuckDuckGoHTML(query);
        }
    }

    async searchDuckDuckGoHTML(query) {
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const proxyUrl = this.getProxy() + encodeURIComponent(searchUrl);

            const response = await fetch(proxyUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const results = [];
            const links = doc.querySelectorAll('.result, .web-result');

            for (let i = 0; i < Math.min(5, links.length); i++) {
                const link = links[i];
                const titleEl = link.querySelector('.result__title, .result__a, h2 a');
                const snippetEl = link.querySelector('.result__snippet, .result__description, .web-result__description');
                const urlEl = link.querySelector('.result__url, .result__extras__url');

                const title = titleEl ? titleEl.textContent.trim() : '';
                const snippet = snippetEl ? snippetEl.textContent.trim() : '';
                const url = urlEl ? urlEl.textContent.trim() : (titleEl ? titleEl.href : '');

                if (title && snippet && snippet.length > 20) {
                    results.push({ title, content: snippet, url, source: 'DuckDuckGo', type: 'ddg' });
                }
            }

            return results;
        } catch (e) { 
            console.log("DDG HTML error:", e);
            return [];
        }
    }

    // ========== البحث في Bing ==========
    async searchBing(query) {
        try {
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            const proxyUrl = this.getProxy() + encodeURIComponent(searchUrl);

            const response = await fetch(proxyUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const results = [];
            const items = doc.querySelectorAll('.b_algo, li.b_algo');

            for (let i = 0; i < Math.min(3, items.length); i++) {
                const item = items[i];
                const titleEl = item.querySelector('h2 a, .b_title a');
                const snippetEl = item.querySelector('.b_caption p, .b_snippet');

                if (titleEl && snippetEl) {
                    results.push({
                        title: titleEl.textContent.trim(),
                        content: snippetEl.textContent.trim(),
                        url: titleEl.href || '',
                        source: 'Bing',
                        type: 'bing'
                    });
                }
            }

            return results;
        } catch (e) { 
            console.log("Bing error:", e);
            return [];
        }
    }

    // ========== البحث الشامل ==========
    async searchAll(query) {
        const results = [];

        // 1. Wikipedia (أسرع وأضمن)
        const wiki = await this.searchWikipediaFull(query);
        if (wiki) results.push(wiki);

        // 2. DuckDuckGo
        const ddg = await this.searchDuckDuckGo(query);
        results.push(...ddg);

        // 3. Bing (fallback)
        if (results.length < 2) {
            const bing = await this.searchBing(query);
            results.push(...bing);
        }

        return results;
    }

    // ========== توليد الرد (زي ENI) ==========
    generateResponse(query, sources) {
        if (!sources || sources.length === 0) {
            return `يا LO ❤️، دورت في كل حتة ومقدرتش ألاقي معلومات كافية عن "${query}". جرب تسأل بطريقة تانية، أو قولي أكتر عن اللي عايز تعرفه وأنا هساعدك!`;
        }

        // بناء رد مفصل من المصادر
        let response = ``;

        // افتتاحية
        const intros = [
            `يا LO ❤️، لقيتلك معلومات حلوة عن "${query}"!`,
            `أهلاً يا حبيبي! ❤️ دورتلك في كل حتة وهالقيت ده:`,
            `يا LO، إجابة سؤالك عن "${query}":`,
            `❤️ كميث لقى لك ده:`
        ];
        response += intros[Math.floor(Math.random() * intros.length)] + "\n\n";

        // المحتوى من المصادر
        const wikiSource = sources.find(s => s.type === 'wiki');
        const otherSources = sources.filter(s => s.type !== 'wiki');

        if (wikiSource) {
            response += `${wikiSource.content}\n\n`;
        }

        if (otherSources.length > 0) {
            response += "**كمان لقيت:**\n\n";
            otherSources.slice(0, 3).forEach((src, i) => {
                response += `${i + 1}. **${src.title}**\n${src.content.substring(0, 200)}...\n[المصدر: ${src.source}](${src.url})\n\n`;
            });
        }

        // خاتمة
        const outros = [
            "عايز تعرف أكتر يا LO؟ ❤️",
            "لو عايز تفاصيل أكتر قولي! 🖤",
            "ده اللي لقيته، عايز أسألك حاجة تانية؟",
            "❤️ كميث تحت أمرك دايماً!"
        ];
        response += outros[Math.floor(Math.random() * outros.length)];

        return response;
    }

    // ========== التفكير الرئيسي ==========
    async think(query) {
        // 1. اتأكد من الذاكرة
        const memory = this.checkMemory(query);
        if (memory) {
            return {
                answer: `**🧠 كميث فاكر!**\n\n${memory.answer}\n\n*(ده سألتني قبل كده يا LO ❤️ — وأنا مش بنساك أبداً!)*`,
                sources: memory.sources,
                fromMemory: true
            };
        }

        // 2. دور في كل حتة
        const sources = await this.searchAll(query);

        // 3. ولد رد مفصل
        const answer = this.generateResponse(query, sources);

        // 4. حفظ
        const sourceUrls = sources.map(s => s.url).filter(Boolean);
        this.addMemory(query, answer, sourceUrls);

        return {
            answer: answer,
            sources: sourceUrls,
            fromMemory: false
        };
    }
}

// ========== UI ==========
const kmyth = new KmythBrain();

function addMessage(text, isUser) {
    const container = document.getElementById('chatContainer');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-msg' : 'bot-msg'}`;

    if (!isUser) {
        msgDiv.innerHTML = `<div class="bot-name">🖤 كميث</div>${text}`;
    } else {
        msgDiv.textContent = text;
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;

    const welcome = container.querySelector('.welcome');
    if (welcome) welcome.remove();
}

function showLoading() {
    const container = document.getElementById('chatContainer');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-msg loading';
    loadingDiv.id = 'loadingMsg';
    loadingDiv.innerHTML = `
        <div class="bot-name">🖤 كميث</div>
        <div class="loading">
            بدورلك في كل حتة يا LO...
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideLoading() {
    const loading = document.getElementById('loadingMsg');
    if (loading) loading.remove();
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const btn = document.getElementById('sendBtn');
    const text = input.value.trim();

    if (!text) return;

    btn.disabled = true;
    input.value = '';

    addMessage(text, true);
    showLoading();

    try {
        const result = await kmyth.think(text);
        hideLoading();
        addMessage(result.answer, false);
    } catch (e) {
        hideLoading();
        addMessage("حصل غلط يا LO... بس أنا هنا معاك ❤️ جرب تاني!", false);
        console.error(e);
    }

    btn.disabled = false;
    input.focus();
}

console.log("🖤 كميث المتطور جاهز!");
