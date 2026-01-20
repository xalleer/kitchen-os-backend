import cloudscraper
from bs4 import BeautifulSoup
import json
import time
import re

CATEGORIES = [
    ("https://www.atbmarket.com/uk/catalog/287-ovochi-ta-frukti", "Овочі та фрукти"),
    ("https://www.atbmarket.com/uk/catalog/285-bakaliya", "Бакалія"),
    ("https://www.atbmarket.com/uk/catalog/molocni-produkti-ta-ajca", "Молочні продукти та яйця"),
    ("https://www.atbmarket.com/uk/catalog/siri", "Сир"),
    ("https://www.atbmarket.com/uk/catalog/maso", "М'ясо"),
    ("https://www.atbmarket.com/uk/catalog/299-konditers-ki-virobi", "Кондитерські вироби"),
    ("https://www.atbmarket.com/uk/catalog/353-riba-i-moreprodukti", "Риба та морепродукти"),
    ("https://www.atbmarket.com/uk/catalog/325-khlibobulochni-virobi", "Хлібобулочні вироби"),
    ("https://www.atbmarket.com/uk/catalog/322-zamorozheni-produkti", "Заморожені продукти"),
    ("https://www.atbmarket.com/uk/catalog/cipsi-sneki", "Чіпси та снеки"),
    ("https://www.atbmarket.com/uk/catalog/360-kovbasa-i-m-yasni-delikatesi", "Ковбаса та м'ясні делікатеси"),
]

# Список відомих брендів для видалення
BRANDS = [
    'галиція', 'галиця', 'лавіна', 'наш край', 'весела ферма', 'президент',
    'добряна', 'ряба', 'фруто няня', 'ніндзя', 'лакто', 'комо', 'ерланг',
    'простоквашино', 'домик в селі', 'селянське', 'новіков', 'пам\'ятаєш',
    'гречка', 'мультипряник', 'натуральний продукт', 'зелена лінія',
    'золотий смак', 'атовська', 'московська', 'домашня', 'крафтова',
    'президент', 'борщ', 'злагода', 'краснодворська', 'дубки', 'свалява',
    'таврія', 'крафт', 'слобожанка', 'любисток', 'олком', 'галичина',
    'моя ласунка', 'містер', 'мультипряник', 'кулінар', 'містер',
    'пильзен', 'сніданок', 'калиновська', 'вишиваний', 'регіональний',
    'гуцульська', 'галичина', 'карпати', 'волинська', 'подільська',
    'середнянська', 'київська', 'полтавська', 'суми', 'чернігівська',
    'херсонська', 'одеса', 'запоріжжя', 'дніпро', 'харків', 'львів',
    # Додаткові бренди
    'біло', 'торчин', 'reed', 'розумний вибір', 'своя лінія', 'original',
    'оріджинал', 'орігінал', 'елітне', 'елітний', 'преміум', 'premium',
    'селект', 'select', 'люкс', 'lux', 'екстра', 'extra', 'клас', 'class',
    'атовський', 'атовська', 'атб', 'чудо', 'чудова', 'наша', 'наше',
    'домашній', 'домашня', 'народний', 'народна'
]

# Маркетингові та описові слова для видалення
MARKETING_WORDS = [
    'цілий', 'ціла', 'ціле', 'цілі', 'без кісточки', 'без кісточок',
    'елітне', 'елітний', 'елітна', 'елітні', 'преміум', 'premium',
    'селект', 'select', 'люкс', 'lux', 'екстра', 'extra', 'клас', 'class',
    'натуральний', 'натуральна', 'натуральне', 'натуральні',
    'органічний', 'органічна', 'органічне', 'органічні',
    'до шашлику', 'до борщу', 'до м\'яса', 'до риби', 'до салату',
    'для смаку', 'для маринування', 'для випічки', 'для салату',
    'вишуканий', 'вишукана', 'вишукане', 'вишукані',
    'особливий', 'особлива', 'особливе', 'особливі',
    'фірмовий', 'фірмова', 'фірмове', 'фірмові'
]

    # Патерни для форм фасування та упаковки
PACKAGING_PATTERNS = [
    r'п/ванночк[ауі]', r'п\.\s*ванночк[ауі]', r'пл/ванночк[ауі]',
    r'д/пак', r'д\.\s*пак', r'для\s*пак',
    r'пл/відро', r'пл\.\s*відро',
    r'пл/стак', r'пл\.\s*стак',
    r'пл/уп', r'пл\.\s*уп', r'пл/пакет',
    r'\d+\s*шт', r'\d+\s*шт\.', r'шт\s*\d+', r'шт\.\s*\d+',
    r'в\s*пакеті', r'в\s*пакет', r'\bв\s+уп\b', r'в\s*упаковці',  # "в уп" як окреме слово
    r'\bпакет\b', r'\bуп\.\b', r'\bуп\b(?=\s|$)', r'відро', r'стакан', r'стак',  # "уп" тільки як окреме слово
    r'\([Мм]\)', r'\([Ss]\)', r'\([Ll]\)', r'\([XxL]\)'
]

def normalize_latin_to_cyrillic(text):
    """
    Замінює латинські літери, які схожі на кириличні, на кириличні.
    Наприклад: Kpeм -> Крем, Шaшлик -> Шашлик
    """
    # Мапінг латинських літер на кириличні (тільки для тих, що виглядають однаково)
    latin_to_cyrillic = {
        'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у',
        'A': 'А', 'E': 'Е', 'O': 'О', 'P': 'Р', 'C': 'С', 'X': 'Х', 'Y': 'У',
        'K': 'К', 'M': 'М', 'T': 'Т', 'H': 'Н', 'B': 'В'
    }
    
    result = []
    for char in text:
        if char in latin_to_cyrillic:
            result.append(latin_to_cyrillic[char])
        else:
            result.append(char)
    return ''.join(result)

def normalize_product_name(title):
    """
    Нормалізує назву продукту, видаляючи бренди та зайву інформацію.
    Приклади:
    - 'Kpeм-сир Біло Original п/ванночку' -> 'Крем-сир'
    - 'Kетчуп Торчин до Шaшлику д/пaк' -> 'Кетчуп'
    - 'Абрикос сушений Розумний вибір цілий без кісточки' -> 'Абрикос сушений'
    - 'Авокадо Reed елітне 1 шт ат' -> 'Авокадо'
    """
    if not title or len(title.strip()) < 2:
        return title
    
    # Спочатку прибираємо латинські бренди ПЕРЕД нормалізацією
    # Це важливо, бо після нормалізації латинські букви стають кириличними змішано
    latin_brands = ['original', 'reed', 'premium', 'select', 'lux', 'extra', 'class']
    for brand in latin_brands:
        title = re.sub(r'\b' + re.escape(brand) + r'\b', '', title, flags=re.IGNORECASE)
    
    # Тепер нормалізуємо латинські літери до кириличних
    title = normalize_latin_to_cyrillic(title)
    
    # Прибираємо скобки та їх вміст (включаючи технічні позначки)
    title = re.sub(r'\([^)]*\)', '', title)
    title = re.sub(r'\[[^\]]*\]', '', title)
    
    # Прибираємо кириличні варіанти брендів (після нормалізації)
    title = re.sub(r'\bоріджинал\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bорігінал\b', '', title, flags=re.IGNORECASE)
    
    # Прибираємо форми фасування та упаковки
    for pattern in PACKAGING_PATTERNS:
        title = re.sub(pattern, '', title, flags=re.IGNORECASE)
    
    # Прибираємо розміри та ваги (100г, 500г, 1л, 900мл, 200мл, 0.5 кг, 300/500г тощо)
    title = re.sub(r'\d+[,\.]?\d*\s*/\s*\d+[,\.]?\d*\s*[гкг]', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\d+[,\.]?\d*\s*[гкг]', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\d+[,\.]?\d*\s*[млл]', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\d+[,\.]?\d*\s*кг\b', '', title, flags=re.IGNORECASE)
    
    # Прибираємо відсотки (2.5%, 3.2%, 9% тощо)
    title = re.sub(r'\d+[,\.]?\d*\s*%', '', title)
    
    # Прибираємо бренди (спочатку довгі, потім короткі)
    for brand in sorted(BRANDS, key=len, reverse=True):
        # Шукаємо бренд як окреме слово (з урахуванням можливих пробілів)
        pattern = r'\b' + re.escape(brand) + r'\b'
        title = re.sub(pattern, '', title, flags=re.IGNORECASE)
    
    # Прибираємо маркетингові слова та фрази
    for word in MARKETING_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        title = re.sub(pattern, '', title, flags=re.IGNORECASE)
    
    # Прибираємо складні маркетингові фрази
    title = re.sub(r'\bцілий\s+без\s+кісточк[іи]\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bбез\s+кісточк[іи]\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bдо\s+[а-яієїщ]+у\b', '', title, flags=re.IGNORECASE)  # "до шашлику", "до борщу" тощо
    title = re.sub(r'\bдля\s+[а-яієїщ]+[аи]\b', '', title, flags=re.IGNORECASE)  # "для салату", "для маринування" тощо
    
    # Прибираємо технічні характеристики та скорочення (як окремі слова)
    # Важливо: робимо це перед видаленням чисел, щоб не залишити самотні числа
    # "ат" видаляємо тільки якщо це окреме слово, не частина слова (наприклад, "салат")
    title = re.sub(r'\s+ат(?=\s|$)', '', title, flags=re.IGNORECASE)  # тільки якщо перед пробілом або в кінці
    title = re.sub(r'(?<=\s)ат(?=\s|$)', '', title, flags=re.IGNORECASE)  # тільки якщо перед та після пробіл або кінець
    title = re.sub(r'\s*\bшт\.?\b\s*', ' ', title, flags=re.IGNORECASE)
    title = re.sub(r'\s*\bкг\b\s*', ' ', title, flags=re.IGNORECASE)
    # "г" видаляємо тільки якщо перед ним є число або це окреме слово після числа
    title = re.sub(r'\d+\s*г\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s+\bг\b(?=\s|$)', ' ', title, flags=re.IGNORECASE)  # тільки якщо перед пробілом або в кінці
    title = re.sub(r'\s+\bмл\b(?=\s|$)', ' ', title, flags=re.IGNORECASE)  # "мл" тільки як окреме слово
    
    # Прибираємо послідовності чисел, що залишилися
    title = re.sub(r'\b\d+\b', '', title)
    
    # Прибираємо зайві пробіли та спецсимволи (але залишаємо дефіси)
    title = re.sub(r'\s+', ' ', title)
    # Залишаємо тільки літери, цифри, пробіли та дефіси (кирилиця та латиниця)
    # Дефіс ставимо в кінці, щоб не створювати діапазон
    title = re.sub(r'[^\w\sа-яієїщА-ЯІЄЇЩ-]', '', title)
    # Нормалізуємо множинні дефіси до одного
    title = re.sub(r'-+', '-', title)
    # Прибираємо дефіси на початку та в кінці
    title = title.strip()
    
    # Прибираємо початкові та кінцеві дефіси та крапки
    title = title.strip('-').strip('.').strip()
    
    # Якщо назва порожня або дуже коротка після обробки, спробуємо знайти основну назву
    if len(title) < 2:
        # Розділяємо на слова і беремо перше значуще слово
        words = [w for w in title.split() if len(w) > 1]
        if words:
            return words[0].strip()
        return title if title else 'Продукт'
    
    # Фінальне очищення - залишаємо тільки перші 3-4 слова (щоб не було занадто довго)
    words = [w for w in title.split() if len(w) > 1]
    if len(words) > 4:
        title = ' '.join(words[:4])
    
    return title

def determine_unit(category, title):
    """
    Визначає одиницю вимірювання на основі категорії та назви продукту.
    Повертає 'G', 'ML', або 'PCS'
    """
    title_lower = title.lower()
    category_lower = category.lower()
    
    # Рідини та молочні продукти зазвичай в ML
    liquid_keywords = ['молоко', 'сік', 'напій', 'вода', 'йогурт', 'кефір', 
                      'ряженка', 'сметана', 'майонез', 'олия', 'соус',
                      'сироп', 'квас', 'лимонад', 'борщ', 'суп']
    if any(keyword in title_lower for keyword in liquid_keywords):
        return 'ML'
    
    # М'ясо, риба, сир, ковбаса зазвичай в G
    if any(keyword in category_lower for keyword in ['м\'ясо', 'риба', 'сир', 'ковбаса', 'делікатеси']):
        return 'G'
    
    # Овочі та фрукти можуть бути як в штуках, так і в грамах
    if 'овочі' in category_lower or 'фрукти' in category_lower:
        # Якщо це цілі овочі/фрукти - штуки, інакше грами
        piece_keywords = ['яблуко', 'груша', 'апельсин', 'лимон', 'авокадо',
                         'кавун', 'диня', 'кабачок', 'огірок', 'помідор',
                         'перець', 'баклажан', 'капуста', 'голівка', 'цибуля',
                         'часник', 'морква', 'буряк', 'картопля', 'банан']
        if any(keyword in title_lower for keyword in piece_keywords):
            return 'PCS'
        return 'G'
    
    # Хлібобулочні - зазвичай штуки
    if 'хліб' in category_lower or 'булочні' in category_lower:
        # Але якщо це борошно або інше - грами
        if any(keyword in title_lower for keyword in ['борошно', 'крохмаль', 'дріжджі']):
            return 'G'
        return 'PCS'
    
    # Бакалія зазвичай в грамах
    if 'бакалія' in category_lower:
        # Але є винятки для деяких продуктів
        if any(keyword in title_lower for keyword in ['яйце', 'яйця']):
            return 'PCS'
        return 'G'
    
    # Кондитерські вироби - зазвичай в штуках або грамах
    if 'кондитерські' in category_lower:
        # Шоколад, цукерки - грами, але вироби - штуки
        if any(keyword in title_lower for keyword in ['шоколад', 'цукерки', 'печиво', 'вафлі']):
            return 'G'
        return 'PCS'
    
    # За замовчуванням - грами
    return 'G'

def get_products_from_page(soup, category_name):
    items = soup.find_all('article', class_='catalog-item')
    page_data = []
    for item in items:
        try:
            title = item.select_one('.catalog-item__title').text.strip()
            price_element = item.select_one('data.product-price__top')
            price = float(price_element.get('value', 0)) if price_element else 0
            
            # Нормалізуємо назву продукту
            normalized_name = normalize_product_name(title)
            
            if not normalized_name or len(normalized_name) < 2:
                continue
            
            # Визначаємо одиницю вимірювання
            unit = determine_unit(category_name, normalized_name)
            
            page_data.append({
                'originalTitle': title,
                'name': normalized_name,
                'category': category_name,
                'baseUnit': unit,
                'price': price
            })
        except Exception as e:
            continue
    return page_data

def parse_all_atb():
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'darwin', 'desktop': True}
    )

    # Використовуємо dict для унікальних продуктів (за нормалізованою назвою)
    unique_products = {}
    
    for base_url, category_name in CATEGORIES:
        print(f"\n--- ОБРОБКА КАТЕГОРІЇ: {category_name} ---")

        last_page_titles = set()
        page = 1

        while True:
            url = f"{base_url}?page={page}"
            print(f"Парсимо сторінку {page}...")

            try:
                response = scraper.get(url, timeout=15)
                if response.status_code != 200:
                    break

                soup = BeautifulSoup(response.text, 'html.parser')
                current_page_data = get_products_from_page(soup, category_name)

                current_page_titles = {p['originalTitle'] for p in current_page_data}

                if not current_page_data or current_page_titles == last_page_titles:
                    print(f"Кінець категорії {category_name}. (Сторінка {page} повторює попередню або порожня)")
                    break

                # Додаємо продукти, але зберігаємо тільки унікальні за нормалізованою назвою
                for product in current_page_data:
                    normalized_name = product['name'].lower()
                    if normalized_name not in unique_products:
                        unique_products[normalized_name] = product
                    # Можна також зберігати найнижчу ціну, але для початку просто перший продукт
                
                last_page_titles = current_page_titles

                page += 1
                time.sleep(1.2) # Анти-бан затримка

            except Exception as e:
                print(f"Помилка: {e}")
                break

    # Конвертуємо в список продуктів
    products_list = list(unique_products.values())
    
    # Групуємо за категоріями для зручності
    products_by_category = {}
    for product in products_list:
        category = product['category']
        if category not in products_by_category:
            products_by_category[category] = []
        products_by_category[category].append(product)

    return {
        'products': products_list,
        'byCategory': products_by_category
    }

# ЗАПУСК
if __name__ == '__main__':
    all_data = parse_all_atb()

    # Збереження результатів
    output_file = 'atb_products.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    total_products = len(all_data['products'])
    total_categories = len(all_data['byCategory'])
    
    print(f"\n✓ Готово! Дані збережені в {output_file}")
    print(f"✓ Всього унікальних продуктів: {total_products}")
    print(f"✓ Всього категорій: {total_categories}")
    
    # Показуємо статистику по категоріях
    print("\nСтатистика по категоріях:")
    for category, products in all_data['byCategory'].items():
        print(f"  - {category}: {len(products)} продуктів")