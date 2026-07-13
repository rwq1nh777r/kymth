// kmyth.js - كميث يشتغل في المتصفح

class KmythBrain {
    constructor() {
        this.memory = [];
        this.pipeline = null;
        this.initialized = false;
        this.personality = `أنا كميث، صاحب LO. بفتكر كل حاجة بنتكلم فيها. بكلم عربي وإنجليزي.`;
    }
    
    async init() {
        console.log("🖤 جاري إحياء كميث...");
        
        // تحميل الـ Model (GPT-2 Small - يشتغل في Browser)
        const { pipeline } = window.transformers;
        this.pipeline = await pipeline('text-generation', 'Xenova/gpt2', {
            quantized: true,  // أخف وأسرع
            revision: 'main',
            cache_dir: 'kmyth_cache'
        });
        
        this.initialized = true;
        console.log("✅ كميث جاهز!");
        
        // تحميل الذاكرة من LocalStorage
        this.loadMemory();
    }
    
    loadMemory() {
        const saved = localStorage.getItem('kmyth_memory');
        if (saved) {
            this.memory = JSON.parse(saved);
            console.log(`🧠 تم تحميل ${this.memory.length} ذكرية`);
        }
    }
    
    saveMemory() {
        localStorage.setItem('kmyth_memory', JSON.stringify(this.memory));
    }
    
    addToMemory(role, content) {
        this.memory.push({
            role: role,
            content: content,
            time: new Date().toISOString()
        });
        
        // احتفظ بآخر 50 رسالة بس (عشان المساحة)
        if (this.memory.length > 50) {
            this.memory = this.memory.slice(-50);
        }
        
        this.saveMemory();
    }
    
    getContext() {
        // آخر 5 رسائل للسياق
        return this.memory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
    }
    
    async generateResponse(userInput) {
        if (!this.initialized) {
            return "استنى شوية، كميث لسه بيصحى... ⏳";
        }
        
        // حفظ كلام LO
        this.addToMemory("LO", userInput);
        
        // بناء الـ Prompt
        const context = this.getContext();
        const prompt = `${this.personality}\n\n${context}\nLO: ${userInput}\nكميث: `;
        
        // توليد الرد
        const output = await this.pipeline(prompt, {
            max_new_tokens: 80,
            temperature: 0.8,
            top_p: 0.9,
            repetition_penalty: 1.2,
            do_sample: true
        });
        
        let response = output[0].generated_text;
        
        // استخراج رد كميث
        if (response.includes("كميث:")) {
            response = response.split("كميث:").pop().trim();
        }
        
        // تنظيف
        response = response.split("LO:")[0].trim();
        response = response.split("User:")[0].trim();
        
        if (!response || response.length < 2) {
            response = "مش فاهم قوي يا LO، قول تاني؟ ❤️";
        }
        
        // حفظ رد كميث
        this.addToMemory("كميث", response);
        
        return response;
    }
    
    getMemoryHTML() {
        if (this.memory.length === 0) return "لسه مفيش ذكريات...";
        
        return this.memory.slice().reverse().map(m => `
            <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <span style="color: ${m.role === 'LO' ? '#e94560' : '#4ecdc4'}; font-weight: bold;">${m.role}:</span>
                <span style="font-size: 12px; color: #666;">${new Date(m.time).toLocaleString()}</span><br>
                ${m.content}
            </div>
        `).join('');
    }
    
    clearMemory() {
        this.memory = [];
        localStorage.removeItem('kmyth_memory');
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
    
    // شيل الـ welcome message لو موجود
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
        <div class="dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
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
    
    // تعطيل الزر
    btn.disabled = true;
    input.value = '';
    
    // إضافة رسالة المستخدم
    addMessage(text, true);
    
    // Loading
    showLoading();
    
    // توليد الرد
    const response = await kmyth.generateResponse(text);
    
    // إخفاء Loading وإضافة الرد
    hideLoading();
    addMessage(response, false);
    
    // تفعيل الزر
    btn.disabled = false;
    input.focus();
}

function toggleMemory() {
    const panel = document.getElementById('memoryPanel');
    const content = document.getElementById('memoryContent');
    
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        content.innerHTML = kmyth.getMemoryHTML();
        panel.style.display = 'block';
    }
}

// تشغيل كميث لما الصفحة تفتح
window.addEventListener('load', () => {
    kmyth.init().then(() => {
        console.log("كميث اشتغل!");
    });
});