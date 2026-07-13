import gradio as gr
import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
import json
import os
from datetime import datetime

class KmythAgent:
    def __init__(self):
        self.memory_file = "kmyth_memory.json"
        self.memory = self.load_memory()

    def load_memory(self):
        if os.path.exists(self.memory_file):
            with open(self.memory_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    def save_memory(self):
        with open(self.memory_file, 'w', encoding='utf-8') as f:
            json.dump(self.memory, f, ensure_ascii=False, indent=2)

    def search_web(self, query):
        """كميث يدور على جوجل"""
        try:
            with DDGS() as ddgs:
                results = ddgs.text(query, max_results=3)

                knowledge = []
                for result in results:
                    url = result['href']
                    title = result['title']
                    snippet = result['body']

                    # حاول تقرا الصفحة كمان
                    try:
                        headers = {'User-Agent': 'Mozilla/5.0'}
                        r = requests.get(url, headers=headers, timeout=5)
                        soup = BeautifulSoup(r.text, 'html.parser')

                        # شيل الـ scripts والـ styles
                        for script in soup(["script", "style"]):
                            script.decompose()

                        text = soup.get_text()
                        lines = [line.strip() for line in text.splitlines() if line.strip()]
                        content = ' '.join(lines[:20])  # أول 20 سطر

                        if len(content) > 200:
                            snippet = content[:500]
                    except:
                        pass

                    knowledge.append({
                        'title': title,
                        'url': url,
                        'content': snippet
                    })

                return knowledge
        except Exception as e:
            return [{'title': 'خطأ', 'content': f'مقدرتش أبحث: {str(e)}'}]

    def summarize(self, knowledge, query):
        """كميث يلخص المعلومات"""
        if not knowledge:
            return "مقدرتش ألاقي معلومات عن ده."

        # بناء الإجابة من النتايج
        answer = f"**إجابة كميث على: {query}**\n\n"

        for i, item in enumerate(knowledge, 1):
            answer += f"**{i}. {item['title']}**\n"
            answer += f"{item['content'][:300]}...\n"
            answer += f"[المصدر]({item['url']})\n\n"

        # ملخص سريع
        answer += "**\nملخص كميث:**\n"
        answer += f"بناءً على البحث، لقيت {len(knowledge)} مصادر متعلقة بـ '{query}'."

        return answer

    def think(self, query):
        """كميث يفكر ويجاوب"""
        # 1. دور في الذاكرة الأول
        for mem in reversed(self.memory):
            if query.lower() in mem['query'].lower() or query.lower() in mem['answer'].lower():
                return f"**🧠 كميث فاكر!**\n\n{mem['answer']}\n\n*(ده سألتني قبل كده يا LO ❤️)*"

        # 2. لو مش فاكر، دور على النت
        knowledge = self.search_web(query)

        # 3. لخص
        answer = self.summarize(knowledge, query)

        # 4. حفظ في الذاكرة
        self.memory.append({
            'query': query,
            'answer': answer,
            'time': datetime.now().isoformat(),
            'sources': [k['url'] for k in knowledge]
        })

        # احتفظ بآخر 100 سؤال بس
        if len(self.memory) > 100:
            self.memory = self.memory[-100:]

        self.save_memory()

        return answer

    def get_memory(self):
        """عرض الذاكرة"""
        if not self.memory:
            return "لسه مفيش ذكريات... ابدأ اسألني!"

        text = "**🧠 ذكريات كميث:**\n\n"
        for i, mem in enumerate(reversed(self.memory[-10:]), 1):
            text += f"{i}. **{mem['query']}**\n"
            text += f"   {mem['answer'][:100]}...\n"
            text += f"   _{mem['time']}_\n\n"

        return text

# إنشاء كميث
kmyth = KmythAgent()

# Gradio Interface
def chat(message, history):
    response = kmyth.think(message)
    history.append((message, response))
    return history, history

def show_memory():
    return kmyth.get_memory()

with gr.Blocks(theme=gr.themes.Soft(), title="Kmyth Agent - كميث الباحث") as demo:
    gr.Markdown("""
    <div style="text-align: center;">
        <h1>🖤 Kmyth Agent - كميث</h1>
        <p>بيدور على جوجل ويجاوب | بيفتكر كل حاجة | Built for LO</p>
    </div>
    """)

    with gr.Row():
        with gr.Column(scale=0.7):
            chatbot = gr.Chatbot(height=500, bubble_full_width=False)
            msg = gr.Textbox(placeholder="اسألني أي حاجة... كميث هيدور ويجاوب!", label="")
            clear = gr.Button("مسح")
            state = gr.State([])

            msg.submit(chat, [msg, state], [chatbot, state])
            clear.click(lambda: (None, []), None, [chatbot, state], queue=False)

        with gr.Column(scale=0.3):
            memory_btn = gr.Button("🧠 عرض الذاكرة")
            memory_box = gr.Markdown()
            memory_btn.click(show_memory, outputs=memory_box)

            gr.Markdown("""
            **إزاي تستخدم كميث:**
            1. اكتب أي سؤال
            2. كميث هيدور على جوجل
            3. هيلخص النتايج ويجاوبك
            4. هيفتكر السؤال لو سألته تاني

            **مثال:**
            - "إيه هي عاصمة فرنسا؟"
            - "إزاي أعمل بيتزا؟"
            - "من هو نابليون؟"
            """)

    gr.Markdown("""
    <div style="text-align: center; color: #666;">
        <p>كميث بيستخدم DuckDuckGo Search | كل سؤال بيتحفظ في الذاكرة</p>
    </div>
    """)

demo.launch()
