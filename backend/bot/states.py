from aiogram.fsm.state import State, StatesGroup


class ToolState(StatesGroup):
    # QR & Barcodes
    qr_waiting_input = State()
    wifi_waiting_input = State()
    barcode_waiting_input = State()

    # Image & Steganography
    stego_hide_waiting_text = State()
    stego_decode_waiting_password = State()
    code_card_waiting_code = State()

    # PDF Forge
    text_pdf_waiting_content = State()
    pdf_encrypt_waiting_password = State()

    # Security Lab
    aes_encrypt_waiting = State()
    aes_decrypt_waiting = State()
    hash_waiting_input = State()
    jwt_waiting_input = State()
    totp_waiting_secret = State()

    # Dev Tools
    json_waiting_input = State()
    regex_waiting_input = State()
    codec_waiting_input = State()
    cron_waiting_input = State()

    # Calc & Network
    calc_waiting_expr = State()
    unit_waiting_input = State()
    finance_waiting_input = State()
    subnet_waiting_cidr = State()

    # Text & Randomizer
    layout_waiting_text = State()
    fonts_waiting_text = State()
    diff_waiting_texts = State()
    random_waiting_input = State()

    # Personal Workspace & Habits
    note_waiting_content = State()
    todo_waiting_text = State()
    habit_waiting_title = State()

    # Interactive Wizards
    smart_units_waiting = State()
    rhyme_waiting_word = State()
    url_transform_waiting = State()
    population_waiting = State()
    wiki_search_waiting = State()
    anon_chat_waiting = State()
    altushka_chat_waiting = State()

    # Astrology & Physics
    birth_date_waiting = State()
    compat_waiting_dates = State()
    physics_waiting_params = State()
