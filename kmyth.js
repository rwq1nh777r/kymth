// kmyth.js - كميث الباحث (يشتغل في المتصفح)

class KmythBrain {
    constructor() {
        this.memory = this.loadMemory();
        this.proxy = "https://api.allorigins.win/raw?url=";
    }

    loadMemory() {
        try {
            const saved = localStorage.getItem('kmyth_memory');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    saveMemory() {
        try {
            localStorage.setItem('kmyth_memory', JSON.stringify(this.memory));
        } catch {}
    }

    addMemory(query, answer, sources) {
        this.memory.push({
            query: query,
            answer: answer,
            sources: sources,
            time: new Date().toISOString()
        });

        // احتفظ بآخر 50 سؤال
        if (this.memory.length > 50) {
            this.memory = this.memory.slice(-50);
        }

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

    // البحث في Wikipedia
    async searchWikipedia(query) {
        try {
            const searchUrl = `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl);

            if (response.ok) {
                const data = await response.json();
                if (data.extract) {
                    return {
                        title: data.title,
                        content: data.extract,
                        url: data.content_urls?.desktop?.page || `https://ar.wikipedia.org/wiki/${data.title}`,
                        source: 'Wikipedia'
                    };
                }
            }

            // جرب الإنجليزي
            const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const enResponse = await fetch(enUrl);

            if (enResponse.ok) {
                const data = await enResponse.json();
                if (data.extract) {
                    return {
                        title: data.title,
                        content: data.extract,
                        url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${data.title}`,
                        source: 'Wikipedia'
                    };
                }
            }
        } catch (e) {
            console.log("Wikipedia error:", e);
        }
        return null;
    }

    // البحث في DuckDuckGo عبر proxy
    async searchDuckDuckGo(query) {
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const proxyUrl = this.proxy + encodeURIComponent(searchUrl);

            const response = await fetch(proxyUrl);
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const results = [];
            const links = doc.querySelectorAll('.result');

            for (let i = 0; i < Math.min(3, links.length); i++) {
                const link = links[i];
                const titleEl = link.querySelector('.result__title');
                const snippetEl = link.querySelector('.result__snippet');
                const urlEl = link.querySelector('.result__url');

                if (titleEl && snippetEl) {
                    results.push({
                        title: titleEl.textContent.trim(),
                        content: snippetEl.textContent.trim(),
                        url: urlEl ? urlEl.href : '',
                        source: 'DuckDuckGo'
                    });
                }
            }

            return results;
        } catch (e) {
            console.log("DuckDuckGo error:", e);
            return [];
        }
    }

    // البحث في NewsAPI (مجاني - محتاج key بس هنستخدم demo)
    async searchNews(query) {
        try {
            const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=demo&pageSize=3`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.articles) {
                return data.articles.map(a => ({
                    title: a.title,
                    content: a.description || a.content || '',
                    url: a.url,
                    source: 'News'
                }));
            }
        } catch (e) {
            console.log("News error:", e);
        }
        return [];
    }

    // التفكير الرئيسي
    async think(query) {
        // 1. اتأكد من الذاكرة
        const memory = this.checkMemory(query);
        if (memory) {
            return {
                answer: `**🧠 كميث فاكر!**\n\n${memory.answer}\n\n*(ده سألتني قبل كده يا LO ❤️)*`,
                sources: memory.sources,
                fromMemory: true
            };
        }

        // 2. دور في Wikipedia
        const wikiResult = await this.searchWikipedia(query);
        if (wikiResult) {
            const answer = `**${wikiResult.title}**\n\n${wikiResult.content}\n\n[المصدر: ${wikiResult.source}](${wikiResult.url})`;
            this.addMemory(query, answer, [wikiResult.url]);
            return {
                answer: answer,
                sources: [wikiResult.url],
                fromMemory: false
            };
        }

        // 3. دور في DuckDuckGo
        const ddResults = await this.searchDuckDuckGo(query);
        if (ddResults.length > 0) {
            let answer = `**كميث لقى ${ddResults.length} نتيجة:**\n\n`;
            const sources = [];

            ddResults.forEach((r, i) => {
                answer += `${i + 1}. **${r.title}**\n${r.content}\n[المصدر](${r.url})\n\n`;
                sources.push(r.url);
            });

            this.addMemory(query, answer, sources);
            return {
                answer: answer,
                sources: sources,
                fromMemory: false
            };
        }

        // 4. مفيش نتايج
        const fallback = "مقدرتش ألاقي معلومات كافية عن ده. جرب تسأل بطريقة تانية يا LO ❤️";
        return {
            answer: fallback,
            sources: [],
            fromMemory: false
        };
    }
}

// إنشاء كميث
const kmyth = new KmythBrain();

// UI Functions
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
            بيدور على جوجل...
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
        addMessage("حصل غلط يا LO... جرب تاني ❤️", false);
        console.error(e);
    }

    btn.disabled = false;
    input.focus();
}

// تشغيل
console.log("🖤 كميث جاهز!");
