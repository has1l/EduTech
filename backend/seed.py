"""
Seed script — runs at container startup after alembic.
Idempotent: skips if data already exists.
"""
import asyncio
import uuid
from typing import TypedDict

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.subject import Subject
from app.models.task import Task
from app.models.theory import TheorySection
from app.models.topic import Topic


SUBJECT_CODE = "math_oge"


class _TopicData(TypedDict):
    code: str
    title: str
    weight: float
    difficulty: int


TOPICS: list[_TopicData] = [
    {"code": "percent_fractions", "title": "Проценты и доли", "weight": 0.12, "difficulty": 2},
    {"code": "powers_roots",      "title": "Степени и корни",  "weight": 0.10, "difficulty": 3},
    {"code": "equations",         "title": "Уравнения",        "weight": 0.15, "difficulty": 2},
    {"code": "functions_graphs",  "title": "Функции и графики","weight": 0.12, "difficulty": 3},
    {"code": "geometry_triangles","title": "Геометрия: треугольники","weight": 0.10, "difficulty": 3},
]

THEORY = {
    "percent_fractions": {
        "title": "Проценты. Нахождение части от целого",
        "content": (
            "## Проценты\n\n"
            "1 процент (1%) = 1/100 часть числа.\n\n"
            "**Нахождение процентов от числа:** A% от B = A/100 × B\n\n"
            "**Нахождение числа по его проценту:** если A% равно X, то всё число = X / (A/100) = X × 100/A\n\n"
            "**Процент от целого:** если часть = X, целое = N, то % = X/N × 100\n\n"
            "**Пример:** 40% от 30 = 40/100 × 30 = 12"
        ),
    },
    "powers_roots": {
        "title": "Степени числа. Свойства степеней",
        "content": (
            "## Степени\n\n"
            "aⁿ = a × a × ... × a (n раз)\n\n"
            "**Свойства:**\n"
            "- aᵐ × aⁿ = aᵐ⁺ⁿ\n"
            "- aᵐ / aⁿ = aᵐ⁻ⁿ\n"
            "- (aᵐ)ⁿ = aᵐⁿ\n\n"
            "## Корни\n\n"
            "√(a × b) = √a × √b\n\n"
            "√(a/b) = √a / √b\n\n"
            "**Пример:** √75 = √(25×3) = 5√3"
        ),
    },
    "equations": {
        "title": "Линейные уравнения",
        "content": (
            "## Линейное уравнение ax + b = 0\n\n"
            "**Правила переноса:** при переносе слагаемого через «=» его знак меняется.\n\n"
            "**Раскрытие скобок:** a(b + c) = ab + ac\n\n"
            "**Алгоритм решения:**\n"
            "1. Раскрыть скобки\n"
            "2. Перенести x влево, числа вправо\n"
            "3. Привести подобные\n"
            "4. Разделить обе части на коэффициент при x\n\n"
            "**Проверка:** подставь найденный x в исходное уравнение"
        ),
    },
    "functions_graphs": {
        "title": "Линейная функция y = kx + b",
        "content": (
            "## Линейная функция\n\n"
            "y = kx + b, где k — наклон (угловой коэффициент), b — точка пересечения с осью y.\n\n"
            "**Нахождение k по двум точкам (x₁,y₁) и (x₂,y₂):**\n"
            "k = (y₂ − y₁) / (x₂ − x₁)\n\n"
            "**Нахождение b:** подстави любую точку в y = kx + b\n\n"
            "**Пример:** через (0, −2) и (3, 4):\n"
            "k = (4 − (−2)) / (3 − 0) = 6/3 = 2\n"
            "b = −2 (из первой точки)"
        ),
    },
    "geometry_triangles": {
        "title": "Теорема Пифагора и виды треугольников",
        "content": (
            "## Теорема Пифагора\n\n"
            "В прямоугольном треугольнике: c² = a² + b², где c — гипотенуза.\n\n"
            "**Пример:** катеты 6 и 8 → c = √(36 + 64) = √100 = 10\n\n"
            "## Равносторонний треугольник\n\n"
            "Все три стороны равны: P = 3a, значит a = P/3\n\n"
            "## Равнобедренный треугольник\n\n"
            "Два основания равны: P = 2a + b"
        ),
    },
}

TASKS_DATA: list[dict] = [
    # ── ПРОЦЕНТЫ ──────────────────────────────────────────────────────────
    {
        "topic": "percent_fractions",
        "question": "В классе 30 учеников. 40% из них сдали экзамен на «отлично». Сколько учеников сдали на «отлично»?",
        "options": [("A","12"), ("B","40"), ("C","18"), ("D","10")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"40% от 30 = 40/100 × 30 = 0.4 × 30 = 12"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"Ты написал сам процент (40) вместо нахождения 40% от 30"},
            "C": {"error_type":"conceptual","hypothesis":"Ты нашёл 60% (100%-40%=60%) вместо 40%"},
            "D": {"error_type":"arithmetic","hypothesis":"Ты поделил на 3, но для нахождения процентов нужно умножить на 40/100"},
        },
    },
    {
        "topic": "percent_fractions",
        "question": "Цена товара снизилась на 15% и стала 850 рублей. Какой была цена до снижения?",
        "options": [("A","1000"), ("B","977"), ("C","722"), ("D","935")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"Цена стала 85% от исходной. Исходная = 850 / 0.85 = 1000"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"Ты посчитал 850 × 1.15, но 850 — уже сниженная цена, а не исходная"},
            "C": {"error_type":"arithmetic","hypothesis":"Ты снова вычел процент из 850, но 850 — это уже сниженная цена"},
            "D": {"error_type":"arithmetic","hypothesis":"Ты прибавил 15% не от той суммы: 15% нужно брать от исходной цены, а не от 850"},
        },
    },
    {
        "topic": "percent_fractions",
        "question": "Из 200 деталей 5% оказались бракованными. Сколько деталей прошли контроль качества?",
        "options": [("A","190"), ("B","10"), ("C","195"), ("D","100")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"Бракованных: 5% от 200 = 10. Прошли контроль: 200 - 10 = 190"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"Ты нашёл количество бракованных (10), а вопрос про те, что прошли контроль"},
            "C": {"error_type":"arithmetic","hypothesis":"Ты вычел сам процент (5) вместо количества бракованных. Сначала найди 5% от 200"},
            "D": {"error_type":"arithmetic","hypothesis":"Откуда взялось 100? Проверь: 5% от 200 = ?"},
        },
    },
    {
        "topic": "percent_fractions",
        "question": "Банк начислил 8% годовых на вклад 5000 рублей. Сколько рублей составят проценты за год?",
        "options": [("A","400"), ("B","4000"), ("C","540"), ("D","80")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"8% от 5000 = 8/100 × 5000 = 400 рублей"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"4000 = 5000 × 0.8, ты умножил на 0.8 вместо 0.08"},
            "C": {"error_type":"conceptual","hypothesis":"Откуда 540? Попробуй: 8/100 × 5000"},
            "D": {"error_type":"arithmetic","hypothesis":"80 = 8 × 10, но нужно 8% именно от 5000, а не от 1000"},
        },
    },

    # ── СТЕПЕНИ И КОРНИ ────────────────────────────────────────────────────
    {
        "topic": "powers_roots",
        "question": "Чему равно 2³ × 2⁴?",
        "options": [("A","128"), ("B","4096"), ("C","64"), ("D","14")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"2³ × 2⁴ = 2^(3+4) = 2⁷ = 128"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"4096 = 2¹², ты перемножил показатели (3×4=12), но при умножении они складываются"},
            "C": {"error_type":"arithmetic","hypothesis":"64 = 2⁶, ты сложил показатели неверно: 3+4 = ?"},
            "D": {"error_type":"conceptual","hypothesis":"14 = 2×7, ты сложил основания или показатели не так. Вспомни: aᵐ × aⁿ = aᵐ⁺ⁿ"},
        },
    },
    {
        "topic": "powers_roots",
        "question": "Упрости: √75 − √12",
        "options": [("A","3√3"), ("B","√63"), ("C","√7"), ("D","2√3")],
        "answer": "A",
        "difficulty": 3,
        "solution": [{"step":1,"text":"√75 = 5√3, √12 = 2√3. Ответ: 5√3 − 2√3 = 3√3"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"√(75−12) ≠ √75 − √12. Сначала вынеси √3 из каждого слагаемого"},
            "C": {"error_type":"conceptual","hypothesis":"√(75/12) ≠ √75 − √12. Нужно разложить каждое число: 75 = 25×3, 12 = 4×3"},
            "D": {"error_type":"arithmetic","hypothesis":"Ты верно нашёл √12 = 2√3, но √75 = √(25×3) = ?"},
        },
    },
    {
        "topic": "powers_roots",
        "question": "Чему равно (3²)³?",
        "options": [("A","729"), ("B","27"), ("C","81"), ("D","216")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"(3²)³ = 3^(2×3) = 3⁶ = 729"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"27 = 3³, ты взял только одну из степеней. При возведении степени в степень показатели перемножаются"},
            "C": {"error_type":"arithmetic","hypothesis":"81 = 3⁴, ты сложил показатели (2+3=5? или 2+2=4?). Нужно 2×3"},
            "D": {"error_type":"arithmetic","hypothesis":"Откуда 216? Проверь: 3² = 9, потом 9³ = ?"},
        },
    },
    {
        "topic": "powers_roots",
        "question": "Вычисли: √144",
        "options": [("A","12"), ("B","72"), ("C","14"), ("D","11")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"12 × 12 = 144, значит √144 = 12"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"72 = 144/2, ты поделил на 2, но квадратный корень — это число, которое в квадрате даёт 144"},
            "C": {"error_type":"arithmetic","hypothesis":"14² = 196, а не 144. Попробуй 12² = ?"},
            "D": {"error_type":"arithmetic","hypothesis":"11² = 121, а нам нужно 144. Какое число ×  само себя = 144?"},
        },
    },

    # ── УРАВНЕНИЯ ────────────────────────────────────────────────────────
    {
        "topic": "equations",
        "question": "Реши уравнение: 3x − 7 = 2x + 5",
        "options": [("A","12"), ("B","-2"), ("C","2"), ("D","-12")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"3x − 2x = 5 + 7 → x = 12"}],
        "errors": {
            "B": {"error_type":"sign","hypothesis":"При переносе через «=» знак меняется. Проверь знаки −7 и +2x при переносе"},
            "C": {"error_type":"arithmetic","hypothesis":"Проверь: 3(2)−7 = −1, 2(2)+5 = 9. Не равны. Как ты переносил слагаемые?"},
            "D": {"error_type":"sign","hypothesis":"x = −12: 3(−12)−7 = −43, 2(−12)+5 = −19. Не равны. Откуда минус?"},
        },
    },
    {
        "topic": "equations",
        "question": "При каком x выполняется: 2(x + 3) = 3(x − 1)?",
        "options": [("A","9"), ("B","3"), ("C","-9"), ("D","0")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"2x+6 = 3x−3 → 6+3 = 3x−2x → x = 9"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"Подставь x=3: 2(6)=12, 3(2)=6. Не равны. Проверь раскрытие скобок"},
            "C": {"error_type":"sign","hypothesis":"x=−9: 2(−6)=−12, 3(−10)=−30. Не равны. Как ты переносил слагаемые?"},
            "D": {"error_type":"conceptual","hypothesis":"x=0: 2(3)=6, 3(−1)=−3. Не равны. Нужно раскрыть скобки и решить"},
        },
    },
    {
        "topic": "equations",
        "question": "Найди корень уравнения: 5(x − 2) = 3x + 4",
        "options": [("A","7"), ("B","3"), ("C","-3"), ("D","1")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"5x−10 = 3x+4 → 2x = 14 → x = 7"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"5(3−2)=5, 3(3)+4=13. Не равны. Проверь раскрытие 5(x−2)"},
            "C": {"error_type":"sign","hypothesis":"Откуда отрицательный ответ? Проверь знаки при переносе 3x и −10"},
            "D": {"error_type":"arithmetic","hypothesis":"5(1−2)=−5, 3(1)+4=7. Не равны. Как ты раскрывал скобки?"},
        },
    },
    {
        "topic": "equations",
        "question": "Реши уравнение: x/3 + 2 = 5",
        "options": [("A","9"), ("B","3"), ("C","21"), ("D","1")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"x/3 = 5 − 2 = 3 → x = 3 × 3 = 9"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"3/3 + 2 = 3, а не 5. Сначала перенеси 2, потом умножь на 3"},
            "C": {"error_type":"arithmetic","hypothesis":"21/3 + 2 = 9, а не 5. Откуда взялось 21?"},
            "D": {"error_type":"arithmetic","hypothesis":"1/3 + 2 ≈ 2.33, а не 5. Как ты решал?"},
        },
    },

    # ── ФУНКЦИИ ──────────────────────────────────────────────────────────
    {
        "topic": "functions_graphs",
        "question": "Функция y = 2x − 3. При x = 4, чему равно y?",
        "options": [("A","5"), ("B","11"), ("C","-5"), ("D","8")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"y = 2×4 − 3 = 8 − 3 = 5"}],
        "errors": {
            "B": {"error_type":"sign","hypothesis":"Ты прибавил 3 вместо вычитания. Смотри на знак: y = 2x − 3"},
            "C": {"error_type":"sign","hypothesis":"−5 = −(8−3). Откуда минус перед всем выражением?"},
            "D": {"error_type":"arithmetic","hypothesis":"8 = 2×4, ты подставил x, но забыл вычесть 3"},
        },
    },
    {
        "topic": "functions_graphs",
        "question": "Прямая проходит через точки (0, −2) и (3, 4). Найди угловой коэффициент k.",
        "options": [("A","2"), ("B","4/3"), ("C","6"), ("D","-2")],
        "answer": "A",
        "difficulty": 3,
        "solution": [{"step":1,"text":"k = (y₂−y₁)/(x₂−x₁) = (4−(−2))/(3−0) = 6/3 = 2"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"4/3 = y₂/x₂ — ты не учёл вторую точку (0,−2). Формула: k = (y₂−y₁)/(x₂−x₁)"},
            "C": {"error_type":"arithmetic","hypothesis":"6 = y₂−y₁ — ты нашёл числитель, но забыл разделить на x₂−x₁ = 3"},
            "D": {"error_type":"conceptual","hypothesis":"−2 — это b (точка пересечения с осью y). Наклон k находится по двум точкам"},
        },
    },
    {
        "topic": "functions_graphs",
        "question": "Где пересекает ось x функция y = 3x − 6?",
        "options": [("A","x=2"), ("B","x=-6"), ("C","x=6"), ("D","x=-2")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"y=0: 3x−6=0 → 3x=6 → x=2"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"x=−6 — это b со знаком. При пересечении с осью x нужно приравнять y=0 и найти x"},
            "C": {"error_type":"arithmetic","hypothesis":"3(6)−6=12≠0. Реши уравнение 3x−6=0"},
            "D": {"error_type":"sign","hypothesis":"3(−2)−6=−12≠0. Проверь знак при переносе: 3x = 6, значит x = ?"},
        },
    },
    {
        "topic": "functions_graphs",
        "question": "Точка (2, 5) лежит на графике y = kx + 1. Найди k.",
        "options": [("A","2"), ("B","5"), ("C","3"), ("D","6")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"5 = k×2 + 1 → 2k = 4 → k = 2"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"k=5: 5×2+1=11≠5. Ты взял y-координату как k. Подставь точку в уравнение"},
            "C": {"error_type":"arithmetic","hypothesis":"k=3: 3×2+1=7≠5. Проверь: из уравнения 5 = 2k+1 нужно найти k"},
            "D": {"error_type":"arithmetic","hypothesis":"k=6: 6×2+1=13≠5. Реши уравнение 5 = k×2 + 1 правильно"},
        },
    },

    # ── ГЕОМЕТРИЯ ─────────────────────────────────────────────────────────
    {
        "topic": "geometry_triangles",
        "question": "В прямоугольном треугольнике катеты равны 6 и 8. Найди гипотенузу.",
        "options": [("A","10"), ("B","14"), ("C","100"), ("D","7")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"c² = 6²+8² = 36+64 = 100 → c = 10"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"14 = 6+8, но гипотенуза — это не сумма катетов. Вспомни теорему Пифагора: c²=a²+b²"},
            "C": {"error_type":"arithmetic","hypothesis":"100 = c², но ты забыл извлечь корень. c = √100 = ?"},
            "D": {"error_type":"conceptual","hypothesis":"7 — среднее катетов. Применяй c² = 6² + 8², затем c = √c²"},
        },
    },
    {
        "topic": "geometry_triangles",
        "question": "Периметр равностороннего треугольника равен 24 см. Найди его сторону.",
        "options": [("A","8"), ("B","12"), ("C","6"), ("D","72")],
        "answer": "A",
        "difficulty": 1,
        "solution": [{"step":1,"text":"Три стороны равны: сторона = 24/3 = 8"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"12 = 24/2 — ты поделил на 2, как для прямоугольника. У треугольника 3 стороны"},
            "C": {"error_type":"conceptual","hypothesis":"6 = 24/4 — это для квадрата. Сколько сторон у треугольника?"},
            "D": {"error_type":"conceptual","hypothesis":"72 = 24×3 — ты умножил. Нам дан периметр (сумма сторон), нужно найти одну сторону"},
        },
    },
    {
        "topic": "geometry_triangles",
        "question": "Угол при основании равнобедренного треугольника равен 50°. Найди угол при вершине.",
        "options": [("A","80°"), ("B","100°"), ("C","50°"), ("D","130°")],
        "answer": "A",
        "difficulty": 2,
        "solution": [{"step":1,"text":"Два угла при основании = 50° каждый. Вершинный = 180°−50°−50° = 80°"}],
        "errors": {
            "B": {"error_type":"arithmetic","hypothesis":"100 = 2×50. Но угол при вершине = 180 − оба угла при основании. Каждый из них 50°"},
            "C": {"error_type":"conceptual","hypothesis":"50° — это угол при основании. У равнобедренного треугольника угол при вершине другой"},
            "D": {"error_type":"arithmetic","hypothesis":"130 = 180−50. Но нужно вычесть ОБА угла при основании: 180−50−50 = ?"},
        },
    },
    {
        "topic": "geometry_triangles",
        "question": "Медиана, проведённая к гипотенузе прямоугольного треугольника с гипотенузой 16 см, равна:",
        "options": [("A","8 см"), ("B","16 см"), ("C","4 см"), ("D","12 см")],
        "answer": "A",
        "difficulty": 3,
        "solution": [{"step":1,"text":"Медиана к гипотенузе = гипотенуза / 2 = 16/2 = 8"}],
        "errors": {
            "B": {"error_type":"conceptual","hypothesis":"Медиана к гипотенузе не равна самой гипотенузе. Вспомни: медиана = половина гипотенузы"},
            "C": {"error_type":"arithmetic","hypothesis":"4 = 16/4. Но медиана к гипотенузе = гипотенуза / 2, а не / 4"},
            "D": {"error_type":"arithmetic","hypothesis":"Откуда 12? Медиана к гипотенузе = 16 / 2 = ?"},
        },
    },
]


async def seed() -> None:
    async with SessionLocal() as db:
        existing = await db.scalar(select(Subject).where(Subject.code == SUBJECT_CODE))
        if existing is not None:
            print("Already seeded, skipping.")
            return

        subject = Subject(id=uuid.uuid4(), code=SUBJECT_CODE, title="Математика ОГЭ")
        db.add(subject)
        await db.flush()

        topic_ids: dict[str, uuid.UUID] = {}
        for t in TOPICS:
            topic = Topic(
                id=uuid.uuid4(),
                subject_id=subject.id,
                code=t["code"],
                title=t["title"],
                weight_in_exam=t["weight"],
                difficulty=t["difficulty"],
            )
            db.add(topic)
            topic_ids[t["code"]] = topic.id
        await db.flush()

        theory_ids: dict[str, uuid.UUID] = {}
        for code, tdata in THEORY.items():
            section = TheorySection(
                id=uuid.uuid4(),
                topic_id=topic_ids[code],
                title=tdata["title"],
                content=tdata["content"],
            )
            db.add(section)
            theory_ids[code] = section.id
        await db.flush()

        for tdata in TASKS_DATA:
            code = tdata["topic"]
            options = [{"id": opt_id, "text": text} for opt_id, text in tdata["options"]]
            typical_errors = {
                k: {"error_type": v["error_type"], "hypothesis": v["hypothesis"]}
                for k, v in tdata["errors"].items()
            }
            task = Task(
                id=uuid.uuid4(),
                topic_id=topic_ids[code],
                type="multiple_choice",
                question_text=tdata["question"],
                options=options,
                correct_answer=tdata["answer"],
                solution_steps=tdata["solution"],
                typical_errors=typical_errors,
                theory_section_ids=[str(theory_ids[code])],
                difficulty=tdata["difficulty"],
            )
            db.add(task)

        await db.commit()
        print(f"Seeded {len(TASKS_DATA)} tasks across {len(TOPICS)} topics.")


if __name__ == "__main__":
    asyncio.run(seed())
