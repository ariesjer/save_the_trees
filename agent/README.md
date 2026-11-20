# סוכן ניטור רישיונות כריתת עצים — קריית היובל, ירושלים

מערכת ניטור יומית לאיתור רישיונות כריתה והעתקה של עצים בקריית היובל, שמירת מצב למניעת כפילויות, ושליחת התראות עם קישור ישיר לטופס ההשגה ([index.html](../index.html)).

## מבנה התיקייה
- `AGENT_INSTRUCTIONS.md` — הנחיות העבודה המלאות של הסוכן.
- `config/kiryat_hayovel.json` — רשימת רחובות, אתרים וגושי מקרקעין של קריית היובל.
- `config/sources.json` — מקורות המידע לסריקה.
- `src/` — קוד הצינור (`fetcher`, `parser`, `geo_filter`, `state_store`, `notifier`, `runner`).
- `tests/` — בדיקות יחידה למסנן הגיאוגרפי וליצירת קישורי ההשגה.

## התקנה והרצה מקומית
```bash
cd agent
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -e ".[dev]"
copy .env.example .env
```

### הרצת בדיקות
```bash
pytest
```

### הרצת צינור הניטור (Dry-Run על קובץ דוגמה או ריצה מלאה)
```bash
python -m src.runner
```

## תזמון אוטומטי
ניתן להריץ פעמיים ביום באמצעות:
- **Windows Task Scheduler:** הפעלת `.venv\Scripts\python.exe -m src.runner`
- **GitHub Actions / Cron:** משימה מתוזמנת בשעות `08:00` ו-`18:00` שעון ישראל.
