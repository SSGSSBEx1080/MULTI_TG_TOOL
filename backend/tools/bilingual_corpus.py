from __future__ import annotations

import hashlib
from typing import Any

# ==============================================================================
# 1. ПОЛНЫЕ ТЕКСТЫ КОНСТИТУЦИЙ И ОСНОВНЫХ СТАТЕЙ (РУССКИЙ + ЯЗЫК ОРИГИНАЛА)
# ==============================================================================
BILINGUAL_CONSTITUTIONS_TEXTS: dict[str, dict[str, Any]] = {
    "RU": {
        "orig_lang": "Русский (официальный подлинник) / English (Official Translation)",
        "preamble_ru": (
            "Мы, многонациональный народ Российской Федерации, соединённые общей судьбой на своей земле, "
            "утверждая права и свободы человека, гражданский мир и согласие, сохраняя исторически сложившееся "
            "государственное единство, исходя из общепризнанных принципов равноправия и самоопределения народов, "
            "чтя память предков, передавших нам любовь и уважение к Отечеству, веру в добро и справедливость, "
            "возрождая суверенную государственность России и утверждая незыблемость её демократической основы, "
            "стремясь обеспечить благополучие и процветание России, исходя из ответственности за свою Родину "
            "перед нынешним и будущими поколениями, сознавая себя частью мирового сообщества, "
            "принимаем КОНСТИТУЦИЮ РОССИЙСКОЙ ФЕДЕРАЦИИ."
        ),
        "preamble_orig": (
            "We, the multinational people of the Russian Federation, united by a common fate on our land, "
            "establishing human rights and freedoms, civic peace and accord, preserving the historically established "
            "state unity, proceeding from the universally recognized principles of equality and self-determination of peoples, "
            "revering the memory of ancestors who have conveyed to us the love for the Fatherland, belief in the good and justice, "
            "reviving the sovereign statehood of Russia and asserting the firmness of its democratic basic, "
            "striving to ensure the well-being and prosperity of Russia, proceeding from the responsibility for our Fatherland "
            "before the present and future generations, recognizing ourselves as part of the world community, "
            "adopt the CONSTITUTION OF THE RUSSIAN FEDERATION."
        ),
        "articles": [
            {
                "num": "Статья 1",
                "title": "Основы конституционного строя",
                "ru": "1. Российская Федерация — Россия есть демократическое федеративное правовое государство с республиканской формой правления.\n2. Наименования Российская Федерация и Россия равнозначны.",
                "orig": "1. The Russian Federation - Russia is a democratic federal law-bound State with a republican form of government.\n2. The names Russian Federation and Russia are equipollent.",
            },
            {
                "num": "Статья 2",
                "title": "Высшая ценность прав человека",
                "ru": "Человек, его права и свободы являются высшей ценностью. Признание, соблюдение и защита прав и свобод человека и гражданина — обязанность государства.",
                "orig": "Man, his rights and freedoms are the supreme value. The recognition, observance and protection of the rights and freedoms of man and citizen shall be the obligation of the State.",
            },
            {
                "num": "Статья 3",
                "title": "Народовластие и суверенитет",
                "ru": "1. Носителем суверенитета и единственным источником власти в Российской Федерации является её многонациональный народ.\n2. Народ осуществляет свою власть непосредственно, а также через органы государственной власти и органы местного самоуправления.\n3. Высшим непосредственным выражением власти народа являются референдум и свободные выборы.",
                "orig": "1. The bearer of sovereignty and the sole source of power in the Russian Federation shall be its multinational people.\n2. The people shall exercise its power directly, as well as through State government bodies and local self-government bodies.\n3. The supreme direct expression of the power of the people shall be referenda and free elections.",
            },
            {
                "num": "Статья 6–10",
                "title": "Гражданство, социальное государство и разделение властей",
                "ru": "Статья 7: Российская Федерация — социальное государство, политика которого направлена на создание условий, обеспечивающих достойную жизнь и свободное развитие человека.\nСтатья 10: Государственная власть в Российской Федерации осуществляется на основе разделения на законодательную, исполнительную и судебную. Органы законодательной, исполнительной и судебной власти самостоятельны.",
                "orig": "Article 7: The Russian Federation is a social State whose policy is aimed at creating conditions for a worthy life and a free development of man.\nArticle 10: State power in the Russian Federation shall be exercised on the basis of its division into legislative, executive and judicial power. Bodies of legislative, executive and judicial power shall be independent.",
            },
            {
                "num": "Статья 14",
                "title": "Светское государство",
                "ru": "1. Российская Федерация — светское государство. Никакая религия не может устанавливаться в качестве государственной или обязательной.\n2. Религиозные объединения отделены от государства и равны перед законом.",
                "orig": "1. The Russian Federation is a secular State. No religion may be established as a State or obligatory one.\n2. Religious associations shall be separate from the State and shall be equal before the law.",
            },
            {
                "num": "Статья 17–21",
                "title": "Неотчуждаемость прав, равенство и достоинство личности",
                "ru": "Статья 17: Основные права и свободы человека неотчуждаемы и принадлежат каждому от рождения.\nСтатья 19: Все равны перед законом и судом.\nСтатья 20: Каждый имеет право на жизнь.\nСтатья 21: Достоинство личности охраняется государством. Ничто не может быть основанием для его умаления.",
                "orig": "Article 17: Fundamental human rights and freedoms are inalienable and shall be enjoyed by everyone since the day of birth.\nArticle 19: All people shall be equal before the law and court.\nArticle 20: Everyone shall have the right to life.\nArticle 21: Human dignity shall be protected by the State. Nothing may serve as a basis for its derogation.",
            },
            {
                "num": "Статья 23–29",
                "title": "Частная жизнь, свобода совести, мысли и слова",
                "ru": "Статья 23: Каждый имеет право на неприкосновенность частной жизни, личную и семейную тайну, тайну переписки и телефонных переговоров.\nСтатья 28: Каждому гарантируется свобода совести, свобода вероисповедания.\nСтатья 29: Каждому гарантируется свобода мысли и слова. Цензура запрещается.",
                "orig": "Article 23: Everyone shall have the right to the inviolability of private life, personal and family secrets, and privacy of correspondence.\nArticle 28: Everyone shall be guaranteed the freedom of conscience and religion.\nArticle 29: Everyone shall be guaranteed the freedom of ideas and speech. Censorship shall be banned.",
            },
            {
                "num": "Статья 46–51",
                "title": "Судебная защита и презумпция невиновности",
                "ru": "Статья 46: Каждому гарантируется судебная защита его прав и свобод.\nСтатья 49: Каждый обвиняемый в совершении преступления считается невиновным, пока его виновность не будет доказана в предусмотренном федеральным законом порядке и установлена вступившим в законную силу приговором суда.\nСтатья 51: Никто не обязан свидетельствовать против себя самого, своего супруга и близких родственников.",
                "orig": "Article 46: Everyone shall be guaranteed judicial protection of his rights and freedoms.\nArticle 49: Everyone accused of committing a crime shall be considered innocent until his guilt is proved according to the rules fixed by the federal law and confirmed by the sentence of a court which has come into legal force.\nArticle 51: No one shall be obliged to give incriminating evidence against himself, his spouse and close relatives.",
            },
        ],
    },
    "US": {
        "orig_lang": "English (1787 Original Text)",
        "preamble_ru": (
            "Мы, народ Соединённых Штатов, дабы образовать более совершенный Союз, установить правосудие, "
            "гарантировать внутреннее спокойствие, обеспечить совместную оборону, содействовать всеобщему "
            "благоденствию и закрепить блага свободы за нами и потомством нашим, торжественно провозглашаем "
            "и устанавливаем настоящую Конституцию для Соединённых Штатов Америки."
        ),
        "preamble_orig": (
            "We the People of the United States, in Order to form a more perfect Union, establish Justice, "
            "insure domestic Tranquility, provide for the common defence, promote the general Welfare, and "
            "secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this "
            "Constitution for the United States of America."
        ),
        "articles": [
            {
                "num": "Article I",
                "title": "Законодательная власть (Конгресс США)",
                "ru": "Раздел 1. Все установленные здесь законодательные полномочия принадлежат Конгрессу Соединённых Штатов, который состоит из Сената и Палаты представителей.",
                "orig": "Section 1. All legislative Powers herein granted shall be vested in a Congress of the United States, which shall consist of a Senate and House of Representatives.",
            },
            {
                "num": "Article II",
                "title": "Исполнительная власть (Президент США)",
                "ru": "Раздел 1. Исполнительная власть предоставляется Президенту Соединённых Штатов Америки. Он занимает свою должность в течение четырёхлетнего срока.",
                "orig": "Section 1. The executive Power shall be vested in a President of the United States of America. He shall hold his Office during the Term of four Years.",
            },
            {
                "num": "Article III",
                "title": "Судебная власть (Верховный суд)",
                "ru": "Раздел 1. Судебная власть Соединённых Штатов предоставляется одному Верховному суду и таким нижестоящим судам, какие Конгресс может время от времени учреждать.",
                "orig": "Section 1. The judicial Power of the United States, shall be vested in one supreme Court, and in such inferior Courts as the Congress may from time to time ordain and establish.",
            },
            {
                "num": "Amendment I (1791)",
                "title": "Первая поправка: свобода религии, слова, печати и собраний",
                "ru": "Конгресс не должен издавать ни одного закона, относящегося к установлению религии либо запрещающего свободное её исповедание, либо ограничивающего свободу слова или печати, или право народа мирно собираться и обращаться к правительству с петициями об удовлетворении жалоб.",
                "orig": "Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.",
            },
            {
                "num": "Amendment II (1791)",
                "title": "Вторая поправка: право на хранение и ношение оружия",
                "ru": "Поскольку хорошо организованное ополчение необходимо для безопасности свободного государства, право народа хранить и носить оружие не должно нарушаться.",
                "orig": "A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.",
            },
            {
                "num": "Amendment IV & V (1791)",
                "title": "Защита личности, жилища и надлежащая правовая процедура",
                "ru": "4-я поправка: Право народа на охрану личности, жилища, бумаг и имущества от необоснованных обысков и арестов не должно нарушаться.\n5-я поправка: Никто не должен принуждаться в уголовном деле быть свидетелем против самого себя и не может быть лишён жизни, свободы или собственности без надлежащей правовой процедуры.",
                "orig": "Amendment IV: The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated.\nAmendment V: Nor shall any person be compelled in any criminal case to be a witness against himself, nor be deprived of life, liberty, or property, without due process of law.",
            },
            {
                "num": "Amendment XIII & XIV",
                "title": "Отмена рабства и равная защита законов",
                "ru": "13-я поправка (1865): Ни рабство, ни подневольная работа не должны существовать в Соединённых Штатах.\n14-я поправка (1868): Ни один штат не может отказывать какому-либо лицу в пределах своей юрисдикции в равной защите законов.",
                "orig": "Amendment XIII: Neither slavery nor involuntary servitude, except as a punishment for crime whereof the party shall have been duly convicted, shall exist within the United States.\nAmendment XIV: Nor shall any State deny to any person within its jurisdiction the equal protection of the laws.",
            },
        ],
    },
    "DE": {
        "orig_lang": "Deutsch (Grundgesetz 1949)",
        "preamble_ru": (
            "Сознавая свою ответственность перед Богом и людьми, воодушевлённый волей служить делу мира во всём мире "
            "в качестве равноправного члена объединённой Европы, немецкий народ в силу своей учредительной власти "
            "принял настоящий Основной закон."
        ),
        "preamble_orig": (
            "Im Bewußtsein seiner Verantwortung vor Gott und den Menschen, von dem Willen beseelt, als gleichberechtigtes "
            "Glied in einem vereinten Europa dem Frieden der Welt zu dienen, hat sich das Deutsche Volk kraft seiner "
            "verfassungsgebenden Gewalt dieses Grundgesetz gegeben."
        ),
        "articles": [
            {
                "num": "Artikel 1",
                "title": "Неприкосновенность человеческого достоинства",
                "ru": "(1) Достоинство человека неприкосновенно. Уважать и защищать его — обязанность всякой государственной власти.\n(2) Немецкий народ признаёт поэтому неприкосновенные и неотчуждаемые права человека как основу всякого человеческого сообщества, мира и справедливости на земле.",
                "orig": "(1) Die Würde des Menschen ist unantastbar. Sie zu achten und zu schützen ist Verpflichtung aller staatlichen Gewalt.\n(2) Das Deutsche Volk bekennt sich darum zu unverletzlichen und unveräußerlichen Menschenrechten als Grundlage jeder menschlichen Gemeinschaft, des Friedens und der Gerechtigkeit in der Welt.",
            },
            {
                "num": "Artikel 2 & 3",
                "title": "Свобода личности и равенство перед законом",
                "ru": "Ст. 2: Каждый имеет право на свободное развитие своей личности, поскольку он не нарушает прав других.\nСт. 3: Все люди равны перед законом. Мужчины и женщины равноправны.",
                "orig": "Art. 2: Jeder hat das Recht auf die freie Entfaltung seiner Persönlichkeit, soweit er nicht die Rechte anderer verletzt.\nArt. 3: Alle Menschen sind vor dem Gesetz gleich. Männer und Frauen sind gleichberechtigt.",
            },
            {
                "num": "Artikel 5",
                "title": "Свобода мнений, печати, науки и искусства",
                "ru": "Каждый имеет право свободно выражать и распространять своё мнение устно, письменно и посредством изображения. Цензуры не существует. Искусство и наука, исследования и преподавание свободны.",
                "orig": "Jeder hat das Recht, seine Meinung in Wort, Schrift und Bild frei zu äußern und zu verbreiten. Eine Zensur findet nicht statt. Kunst und Wissenschaft, Forschung und Lehre sind frei.",
            },
            {
                "num": "Artikel 20 & 79(3)",
                "title": "Основы строя и «Оговорка вечности» (Ewigkeitsklausel)",
                "ru": "Ст. 20: Федеративная Республика Германия является демократическим и социальным федеративным государством. Вся государственная власть исходит от народа.\nСт. 79(3): Изменение настоящего Основного закона, затрагивающее принципы статей 1 и 20, недопустимо.",
                "orig": "Art. 20: Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat. Alle Staatsgewalt geht vom Volke aus.\nArt. 79(3): Eine Änderung dieses Grundgesetzes, durch welche die in den Artikeln 1 und 20 niedergelegten Grundsätze berührt werden, ist unzulässig.",
            },
        ],
    },
    "FR": {
        "orig_lang": "Français (Constitution de 1958 & Déclaration de 1789)",
        "preamble_ru": (
            "Французский народ торжественно провозглашает свою приверженность Правам человека и принципам "
            "национального суверенитета, как они определены Декларацией 1789 года, подтверждённой и дополненной "
            "преамбулой Конституции 1946 года, а также Хартией окружающей среды 2004 года."
        ),
        "preamble_orig": (
            "Le peuple français proclame solennellement son attachement aux Droits de l'homme et aux principes "
            "de la souveraineté nationale tels qu'ils ont été définis par la Déclaration de 1789, confirmée et "
            "complétée par le préambule de la Constitution de 1946, ainsi qu'aux droits et devoirs définis dans "
            "la Charte de l'environnement de 2004."
        ),
        "articles": [
            {
                "num": "Article 1 (1958)",
                "title": "Неделимая, светская, демократическая и социальная Республика",
                "ru": "Франция является неделимой, светской, демократической и социальной Республикой. Она обеспечивает равенство перед законом всех граждан без различия происхождения, расы или религии.",
                "orig": "La France est une République indivisible, laïque, démocratique et sociale. Elle assure l'égalité devant la loi de tous les citoyens sans distinction d'origine, de race ou de religion.",
            },
            {
                "num": "Article 2 (1958)",
                "title": "Язык, гимн и девиз Республики",
                "ru": "Языком Республики является французский. Национальная эмблема — трёхцветное знамя: синее, белое, красное. Национальный гимн — «Марсельеза». Девиз Республики — «Свобода, Равенство, Братство».",
                "orig": "La langue de la République est le français. L'emblème national est le drapeau tricolore, bleu, blanc, rouge. L'hymne national est « La Marseillaise ». La devise de la République est « Liberté, Égalité, Fraternité ».",
            },
            {
                "num": "Déclaration 1789 — Art. 1 & 4",
                "title": "Декларация прав человека и гражданина 1789 г.",
                "ru": "Статья 1: Люди рождаются и остаются свободными и равными в правах.\nСтатья 4: Свобода состоит в возможности делать всё, что не наносит вреда другому.",
                "orig": "Article premier: Les hommes naissent et demeurent libres et égaux en droits.\nArticle 4: La liberté consiste à pouvoir faire tout ce qui ne nuit pas à autrui.",
            },
        ],
    },
    "JP": {
        "orig_lang": "日本語 (日本国憲法 1947)",
        "preamble_ru": (
            "Мы, японский народ, действуя через наших должным образом избранных представителей в Парламенте, "
            "исполненные решимости обеспечить для себя и своих потомков плоды мирного сотрудничества со всеми народами "
            "и блага свободы на всей нашей земле, провозглашаем, что суверенная власть принадлежит народу, "
            "и утверждаем настоящую Конституцию."
        ),
        "preamble_orig": (
            "日本国民は、正当に選挙された国会における代表者を通じて行動し、われらとわれらの子孫のために、"
            "諸国民との協和による成果と、わが国全土にわたつて自由のもたらす恵沢を確保し、ここに主権が国民に存することを宣言し、"
            "この憲法を確定する。"
        ),
        "articles": [
            {
                "num": "第1条 (Статья 1)",
                "title": "Статус Императора и народный суверенитет",
                "ru": "Император является символом государства и единства народа, его статус определяется волей народа, которому принадлежит суверенная власть.",
                "orig": "天皇は、日本国の象徴であり日本国民統合の象徴であつて、この地位は、主権の存する日本国民の総意に基く。",
            },
            {
                "num": "第9条 (Статья 9)",
                "title": "Отказ от войны и вооружённых сил",
                "ru": "Искренне стремясь к международному миру, основанному на справедливости и порядке, японский народ на вечные времена отказывается от войны как суверенного права нации, а также от угрозы или применения вооружённой силы как средства разрешения международных споров.",
                "orig": "日本国民は、正義と秩序を基調とする国際平和を誠実に希求し、国権の発動たる戦争と、武力による威嚇又は武力の行使は、国際紛争を解決する手段としては、永久にこれを放棄する。",
            },
            {
                "num": "第13条 & 第21条 (Статьи 13 и 21)",
                "title": "Уважение личности и свобода собраний и слова",
                "ru": "Ст. 13: Все граждане должны уважаться как личности. Их право на жизнь, свободу и стремление к счастью является высшей целью законодательства.\nСт. 21: Гарантируется свобода собраний, объединений, слова, печати и всех иных форм выражения мнений. Никакая цензура не допускается.",
                "orig": "第13条：すべて国民は、個人として尊重される。生命、自由及び幸福追求に対する国民の権利については、最大の尊重を必要とする。\n第21条：集会、結社及び言論、出版その他一切の表現の自由は、これを保障する。検閲は、これをしてはならない。",
            },
        ],
    },
    "GB": {
        "orig_lang": "Latin (Magna Carta 1215) & English (Bill of Rights 1689)",
        "preamble_ru": "Некодифицированная конституция Соединённого Королевства опирается на Великую хартию вольностей (1215), Билль о правах (1689), Акты об унии и парламентский суверенитет.",
        "preamble_orig": "Johannes Dei gratia rex Anglie... salutem. (Magna Carta Libertatum, 1215) & An Act Declaring the Rights and Liberties of the Subject (Bill of Rights, 1689).",
        "articles": [
            {
                "num": "Magna Carta, Clause 39 (1215)",
                "title": "Неприкосновенность свободного человека и суд равных",
                "ru": "Ни один свободный человек не будет арестован или заключён в тюрьму, или лишён владения, или объявлен вне закона, или изгнан, иначе как по законному приговору равных ему и по закону страны.",
                "orig": "Nullus liber homo capiatur, vel imprisonetur, aut disseisiatur, aut utlagetur, aut exuletur, aut aliquo modo destruatur, nisi per legale judicium parium suorum vel per legem terre.",
            },
            {
                "num": "Magna Carta, Clause 40 (1215)",
                "title": "Доступность правосудия",
                "ru": "Никому не будем продавать права и справедливости, никому не будем отказывать в них или замедлять их.",
                "orig": "Nulli vendemus, nulli negabimus, aut differemus rectum aut justiciam.",
            },
            {
                "num": "Bill of Rights, Art. 9 (1689)",
                "title": "Парламентская свобода слова",
                "ru": "Свобода слова, прений и актов в Парламенте не должна стесняться или подвергаться рассмотрению ни в каком суде или месте вне Парламента.",
                "orig": "That the freedom of speech and debates or proceedings in Parliament ought not to be impeached or questioned in any court or place out of Parliament.",
            },
        ],
    },
    "CN": {
        "orig_lang": "中文 (中华人民共和国宪法 1982)",
        "preamble_ru": "Китай — одна из стран мира с самой древней историей. Народы всех национальностей Китая совместными усилиями создали блестящую культуру.",
        "preamble_orig": "中国是世界上历史最悠久的国家之一。中国各族人民共同创造了光辉灿烂的文化，具有光荣的革命传统。",
        "articles": [
            {
                "num": "第一条 & 第二条 (Статьи 1–2)",
                "title": "Государственный строй и власть народа",
                "ru": "Ст. 1: Китайская Народная Республика есть социалистическое государство демократической диктатуры народа.\nСт. 2: Вся власть в Китайской Народной Республике принадлежит народу.",
                "orig": "第一条 中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。\n第二条 中华人民共和国的一切权力属于人民。",
            },
            {
                "num": "第三十三条 (Статья 33)",
                "title": "Равенство граждан и права человека",
                "ru": "Все граждане Китайской Народной Республики равны перед законом. Государство уважает и гарантирует права человека.",
                "orig": "第三十三条 中华人民共和国公民在法律面前一律平等。国家尊重和保障人权。",
            },
        ],
    },
    "CH": {
        "orig_lang": "Deutsch / Français / Italiano (Bundesverfassung 1999)",
        "preamble_ru": "Во имя Всемогущего Бога! Швейцарский народ и кантоны, сознавая свою ответственность перед творением, стремясь укрепить союз в свободе и демократии, принимают настоящую Конституцию.",
        "preamble_orig": "Im Namen Gottes des Allmächtigen! Das Schweizervolk und die Kantone, in der Verantwortung gegenüber der Schöpfung, geben sich folgende Verfassung:",
        "articles": [
            {
                "num": "Art. 1 & Art. 3",
                "title": "Конфедерация и суверенитет кантонов",
                "ru": "Ст. 3: Кантоны суверенны постольку, поскольку их суверенитет не ограничен Федеральной конституцией; они осуществляют все права, которые не переданы Конфедерации.",
                "orig": "Art. 3: Die Kantone sind souverän, soweit ihre Souveränität nicht durch die Bundesverfassung beschränkt ist; sie üben alle Rechte aus, die nicht dem Bund übertragen sind.",
            },
            {
                "num": "Art. 138–141",
                "title": "Прямая демократия и народная инициатива",
                "ru": "100 000 граждан, обладающих правом голоса, могут в течение 18 месяцев с момента официальной публикации их инициативы потребовать частичного или полного пересмотра Федеральной конституции.",
                "orig": "100 000 Stimmberechtigte können innerhalb von 18 Monaten seit der amtlichen Veröffentlichung ihrer Initiative eine Teilrevision der Bundesverfassung verlangen.",
            },
        ],
    },
    "KZ": {
        "orig_lang": "Қазақ тілі / Русский (1995, ред. 2022)",
        "preamble_ru": "Мы, народ Казахстана, объединённый общей исторической судьбой, созидая государственность на исконной казахской земле, сознавая себя миролюбивым гражданским обществом, приверженным идеалам свободы, равенства и согласия, принимаем настоящую Конституцию.",
        "preamble_orig": "Біз, ортақ тарихи тағдыр біріктірген Қазақстан халқы, байырғы қазақ жерінде мемлекеттілік құра отырып, еркіндік, теңдік және татулық мұраттарына берілген бейбітшіл азаматтық қоғам екенімізді ұғына отырып, осы Конституцияны қабылдаймыз.",
        "articles": [
            {
                "num": "1-бап (Статья 1)",
                "title": "Основы Республики Казахстан",
                "ru": "1. Республика Казахстан утверждает себя демократическим, светским, правовым и социальным государством, высшими ценностями которого являются человек, его жизнь, права и свободы.",
                "orig": "1. Қазақстан Республикасы өзін демократиялық, зайырлы, құқықтық және әлеуметтік мемлекет ретінде орнықтырады, оның ең қымбат қазынасы - адам және адамның өмірі, құқықтары мен бостандықтары.",
            },
            {
                "num": "42-бап (Статья 42, ред. 2022)",
                "title": "Однократный семилетний мандат Президента",
                "ru": "Одно и то же лицо не может быть избрано Президентом Республики более одного раза (сроком на 7 лет).",
                "orig": "Бір адам Республика Президенті болып бір реттен артық сайлана алмайды (жеті жыл мерзімге).",
            },
        ],
    },
    "BY": {
        "orig_lang": "Беларуская / Русский (1994, ред. 2022)",
        "preamble_ru": "Мы, народ Республики Беларусь (Беларуси), исходя из ответственности за настоящее и будущее Беларуси, сознавая себя полноправным субъектом мирового сообщества, принимаем настоящую Конституцию — Основной Закон Республики Беларусь.",
        "preamble_orig": "Мы, народ Рэспублікі Беларусь (Беларусі), зыходзячы з адказнасці за цяперашняе і будучае Беларусі, усведамляючы сябе паўнапраўным суб'ектам сусветнай супольнасці, прымаем гэтую Канстытуцыю — Асноўны Закон Рэспублікі Беларусь.",
        "articles": [
            {
                "num": "Артыкул 1 & 2",
                "title": "Унитарное социальное правовое государство",
                "ru": "Ст. 1: Республика Беларусь — унитарное демократическое социальное правовое государство.\nСт. 2: Человек, его права, свободы и гарантии их реализации являются высшей ценностью и целью общества и государства.",
                "orig": "Арт. 1: Рэспубліка Беларусь — унітарная дэмакратычная сацыяльная прававая дзяржава.\nАрт. 2: Чалавек, яго правы, свабоды і гарантыі іх рэалізацыі з'яўляюцца найвышэйшай каштоўнасцю і мэтай грамадства і дзяржавы.",
            },
            {
                "num": "Артыкул 17",
                "title": "Государственные языки",
                "ru": "Государственными языками в Республике Беларусь являются белорусский и русский языки.",
                "orig": "Дзяржаўнымі мовамі ў Рэспубліцы Беларусь з'яўляюцца беларуская і руская мовы.",
            },
        ],
    },
}

DEFAULT_BILINGUAL_FALLBACK: dict[str, dict[str, str]] = {
    "IN": {
        "orig_lang": "English / हिन्दी (Constitution of India 1950)",
        "preamble_orig": "WE, THE PEOPLE OF INDIA, having solemnly resolved to constitute India into a SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC and to secure to all its citizens: JUSTICE, LIBERTY, EQUALITY and FRATERNITY...",
        "preamble_ru": "МЫ, НАРОД ИНДИИ, торжественно решив учредить Индию как СУВЕРЕННУЮ СОЦИАЛИСТИЧЕСКУЮ СВЕТСКУЮ ДЕМОКРАТИЧЕСКУЮ РЕСПУБЛИКУ и обеспечить всем её гражданам: СПРАВЕДЛИВОСТЬ, СВОБОДУ, РАВЕНСТВО и БРАТСТВО...",
        "sample_num": "Article 14 & Article 17",
        "sample_orig": "Art. 14: The State shall not deny to any person equality before the law.\nArt. 17: 'Untouchability' is abolished and its practice in any form is forbidden.",
        "sample_ru": "Ст. 14: Государство не отказывает ни одному лицу в равенстве перед законом.\nСт. 17: «Неприкасаемость» упраздняется, и её практика в любой форме запрещается.",
    },
    "SM": {
        "orig_lang": "Latina / Italiano (Leges Statutae 1600 & Dichiarazione 1974)",
        "preamble_orig": "La Repubblica di San Marino accoglie le norme del diritto internazionale generalmente riconosciute come parte integrante del proprio ordinamento.",
        "preamble_ru": "Республика Сан-Марино принимает общепризнанные нормы международного права как неотъемлемую часть своего правопорядка.",
        "sample_num": "Articolo 1 & 4",
        "sample_orig": "La sovranità della Repubblica risiede nel popolo. Tutti sono uguali davanti alla legge.",
        "sample_ru": "Суверенитет Республики принадлежит народу. Все равны перед законом.",
    },
    "AE": {
        "orig_lang": "العربية / English (Constitution of the UAE 1971)",
        "preamble_orig": "نحن حكام إمارات أبوظبي ودبي والشارقة وعجمان وأم القيوين والفجيرة... رغبةً في إقامة اتحاد متكامل في دولة مستقلة ذات سيادة.",
        "preamble_ru": "Мы, правители эмиратов Абу-Даби, Дубая, Шарджи, Аджмана, Умм-эль-Кайвайна и Фуджейры, стремясь учредить союз в независимом суверенном государстве, провозглашаем Конституцию ОАЭ.",
        "sample_num": "المادة 1 & المادة 25 (Статьи 1 и 25)",
        "sample_orig": "الإمارات العربية المتحدة دولة اتحادية مستقلة ذات سيادة. جميع الأفراد لدى القانون سواء.",
        "sample_ru": "Объединённые Арабские Эмираты — независимое суверенное федеративное государство. Все лица равны перед законом.",
    },
    "IL": {
        "orig_lang": "עברית (חוקי היסוד — Основные законы Израиля)",
        "preamble_orig": "זכויות היסוד של האדם בישראל מושתתות על ההכרה בערך האדם, בקדושת חייו ובהיותו בן-חורין.",
        "preamble_ru": "Основные права человека в Израиле зиждутся на признании ценности человека, святости его жизни и его свободы.",
        "sample_num": "חוק יסוד: כבוד האדם וחירותו (1992)",
        "sample_orig": "אין פוגעים בחייו, בגופו, או בכבודו של אדם באשר הוא אדם.",
        "sample_ru": "Нельзя посягать на жизнь, тело или достоинство человека как такового.",
    },
    "KR": {
        "orig_lang": "한국어 (대한민국헌법 1948/1987)",
        "preamble_orig": "유구한 역사와 전통에 빛나는 우리 대한국민은... 자유민주적 기본질서를 더욱 확고히 하여 헌법을 개정한다.",
        "preamble_ru": "Мы, народ Республики Корея, славный многовековой историей и традициями, укрепляя основы свободного демократического строя, утверждаем настоящую Конституцию.",
        "sample_num": "제1조 & 제70조 (Статьи 1 и 70)",
        "sample_orig": "제1조 ① 대한민국은 민주공화국이다. ② 대한민국의 주권은 국민에게 있고, 모든 권력은 국민으로부터 나온다.\n제70조 대통령의 임기는 5년으로 하며, 중임할 수 없다.",
        "sample_ru": "Ст. 1: Республика Корея — демократическая республика. Суверенитет принадлежит народу.\nСт. 70: Срок полномочий Президента составляет 5 лет, он не может быть переизбран.",
    },
    "BR": {
        "orig_lang": "Português (Constituição da República Federativa do Brasil 1988)",
        "preamble_orig": "Nós, representantes do povo brasileiro, reunidos em Assembléia Nacional Constituinte para instituir um Estado Democrático, promulgamos a seguinte CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL.",
        "preamble_ru": "Мы, представители бразильского народа, собравшись в Национальном Учредительном Собрании для учреждения Демократического Государства, провозглашаем Конституцию Федеративной Республики Бразилия.",
        "sample_num": "Art. 1º & Art. 5º",
        "sample_orig": "Todo o poder emana do povo. Todos são iguais perante a lei, sem distinção de qualquer natureza.",
        "sample_ru": "Вся власть исходит от народа. Все равны перед законом без каких-либо различий.",
    },
    "VA": {
        "orig_lang": "Italiano (Legge Fondamentale dello Stato della Città del Vaticano 2023)",
        "preamble_orig": "Chiamato per disegno divino a presiedere alla Chiesa universale, il Sommo Pontefice esercita la sovranità sullo Stato della Città del Vaticano.",
        "preamble_ru": "Верховный Понтифик осуществляет суверенитет над Государством-городом Ватикан для обеспечения независимости Апостольского Престола.",
        "sample_num": "Articolo 1",
        "sample_orig": "Il Sommo Pontefice, Sovrano dello Stato della Città del Vaticano, ha la pienezza dei poteri legislativo, esecutivo e giudiziario.",
        "sample_ru": "Верховный Понтифик, Суверен Государства-города Ватикан, обладает всей полнотой законодательной, исполнительной и судебной власти.",
    },
    "NO": {
        "orig_lang": "Norsk (Kongeriket Norges Grunnlov 1814)",
        "preamble_orig": "Kongeriket Noreg er eit fritt, sjølvstendig, udeleleg og uavhendeleg rike.",
        "preamble_ru": "Королевство Норвегия является свободным, независимым, неделимым и неотчуждаемым государством.",
        "sample_num": "§ 2 & § 112",
        "sample_orig": "§ 2: Verdigrunnlaget forblir vår kristne og humanistiske arv. Denne Grunnlov skal sikre demokratiet, rettsstaten og menneskerettighetene.\n§ 112: Enhver har rett til et miljø som sikrer helsen.",
        "sample_ru": "§ 2: Настоящая Конституция обеспечивает демократию, правовое государство и права человека.\n§ 112: Каждый имеет право на благоприятную для здоровья окружающую среду, сохраняемую для будущих поколений.",
    },
}


def enrich_constitution_entry(entry: dict[str, Any]) -> dict[str, Any]:
    code = entry["code"]
    if code in BILINGUAL_CONSTITUTIONS_TEXTS:
        bi = BILINGUAL_CONSTITUTIONS_TEXTS[code]
        ru_full = bi["preamble_ru"] + "\n\n" + "\n\n".join(
            f"{a['num']} ({a['title']}): {a['ru']}" for a in bi["articles"]
        )
        orig_full = bi["preamble_orig"] + "\n\n" + "\n\n".join(
            f"{a['num']}: {a['orig']}" for a in bi["articles"]
        )
        return {
            **entry,
            "orig_lang": bi["orig_lang"],
            "preamble_ru": bi["preamble_ru"],
            "preamble_orig": bi["preamble_orig"],
            "articles": bi["articles"],
            "ru_full": ru_full,
            "orig_full": orig_full,
        }
    fb = DEFAULT_BILINGUAL_FALLBACK.get(code)
    if fb:
        articles = [
            {
                "num": fb["sample_num"],
                "title": "Ключевые конституционные положения",
                "ru": fb["sample_ru"],
                "orig": fb["sample_orig"],
            }
        ]
        return {
            **entry,
            "orig_lang": fb["orig_lang"],
            "preamble_ru": fb["preamble_ru"],
            "preamble_orig": fb["preamble_orig"],
            "articles": articles,
            "ru_full": fb["preamble_ru"] + "\n\n" + fb["sample_ru"],
            "orig_full": fb["preamble_orig"] + "\n\n" + fb["sample_orig"],
        }
    return {
        **entry,
        "orig_lang": "Оригинал",
        "preamble_ru": "",
        "preamble_orig": "",
        "articles": [],
        "ru_full": entry.get("key_principles", ""),
        "orig_full": "",
    }


# ==============================================================================
# 2. РАЗВЁРНУТЫЕ СТАТЬИ ПО МИРОВЫМ РЕЛИГИЯМ И ЭНЦИКЛОПЕДИИ (С ПЕРВОИСТОЧНИКАМИ)
# ==============================================================================
RELIGION_FULL_ARTICLES: dict[str, dict[str, str]] = {
    "islam": {
        "orig_script": "الإسلام (Аль-Ислам — «Покорность и вверение себя Единому Богу»)",
        "full_article_ru": (
            "Ислам — вторая по численности и самая быстрорастущая мировая монотеистическая авраамическая религия (~1.9 млрд последователей). "
            "Возник в VII веке (610 г. н.э.) в Хиджазе (Западная Аравия — Мекка и Медина) через проповедь пророка Мухаммада (570–632 гг.). "
            "Фундамент вероучения составляет строгий монотеизм (Таухид): вера в Единого, Вечного, Нерождённого и ни на что не похожего Бога — Аллаха (Сура 112 «Аль-Ихляс»).\n\n"
            "• Священное Писание: Коран (القرآن — «Чтение вслух»), состоящий из 114 сур и более 6200 аятов на классическом арабском языке, а также Сунна — свод хадисов о поступках и высказываниях пророка.\n"
            "• Пять столпов Ислама (Аркан ад-Дин): 1) Шахада — свидетельство веры («Нет божества, кроме Аллаха, и Мухаммад — посланник Аллаха»); "
            "2) Салят (Намаз) — ежедневная пятикратная молитва лицом к Каабе в Мекке; 3) Закят — обязательное ежегодное пожертвование (2.5% с накоплений) в пользу нуждающихся; "
            "4) Саум (Ураза) — пост от рассвета до заката в священный месяц Рамадан; 5) Хадж — паломничество в Мекку хотя бы раз в жизни при наличии возможности.\n"
            "• Культурный и научный вклад: в эпоху «Золотого века ислама» (VIII–XIII вв.) учёные Багдада, Кордовы, Самарканда и Бухары (Аль-Хорезми — от чьего имени произошли слова «алгебра» и «алгоритм», Ибн Сина / Авиценна, Ибн аль-Хайсам, Аль-Бируни) заложили основы современной алгебры, оптики, клинической медицины и астрономии."
        ),
        "primary_quote_orig": "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ (سورة الإخلاص ١١٢: ١-٤)",
        "primary_quote_ru": "«Скажи: Он — Аллах Единый, Аллах Самодостаточный; Он не родил и не был рождён, и нет никого, равного Ему» (Коран, сура 112 «Аль-Ихляс», 1–4).",
    },
    "christianity": {
        "orig_script": "Χριστιανισμός (от греч. Χριστός — «Помазанник / Мессия»)",
        "full_article_ru": (
            "Христианство — крупнейшая мировая авраамическая религия (~2.4 млрд верующих), зародившаяся в I веке н.э. в Палестине вокруг личности, учения, Крестной смерти и Воскресения Иисуса Христа из Назарета.\n\n"
            "• Догматика: вера в Триединого Бога (Святую Троицу — Бога Отца, Бога Сына и Святого Духа) и боговоплощение Иисуса Христа, соединившего в Себе полную божественную и полную человеческую природы (Халкидонский орос 451 г.).\n"
            "• Писание: Библия — Ветхий Завет и Новый Завет (27 книг на древнегреческом койне: 4 Евангелия от Матфея, Марка, Луки и Иоанна, Деяния апостолов, Послания и Откровение).\n"
            "• Этика: Нагорная проповедь, заповедь любви к Богу и ближнему (вплоть до прощения врагов), милосердие и личная нравственная свобода человека."
        ),
        "primary_quote_orig": "Οὕτως γὰρ ἠγάπησεν ὁ Θεὸς τὸν κόσμον, ὥστε τὸν Υἱὸν τὸν μονογενῆ ἔδωκεν... (Κατὰ Ἰωάννην 3:16)",
        "primary_quote_ru": "«Ибо так возлюбил Бог мир, что отдал Сына Своего Единородного, дабы всякий верующий в Него не погиб, но имел жизнь вечную» (Евангелие от Иоанна 3:16).",
    },
    "buddhism": {
        "orig_script": "बुद्ध धर्म / Buddha Dhamma («Учение Пробуждённого»)",
        "full_article_ru": (
            "Буддизм — древнейшая из трёх мировых религий и философско-психологическая система духовного пробуждения, основанная Сиддхартхой Гаутамой (Буддой Шакьямуни) в Северной Индии в VI–V вв. до н.э.\n\n"
            "• Ядро учения — Четыре благородные истины: 1) существование сопряжено со страданием и неудовлетворённостью (дуккха); "
            "2) причина страдания — жажда, привязанность и неведение (танха и авидья); 3) существует прекращение страдания — Нирвана; "
            "4) к нему ведёт Благородный восьмеричный путь (правильное воззрение, намерение, речь, действие, образ жизни, усилие, памятование и сосредоточение).\n"
            "• Три признака бытия (Тилаккхана): непостоянство всех составных явлений (аничча), неудовлетворённость (дуккха) и отсутствие неизменного обособленного «Я» (анатта)."
        ),
        "primary_quote_orig": "Sabbe saṅkhārā aniccā — yadā paññāya passati, atha nibbindati dukkhe; esa maggo visuddhiyā. (Dhammapada, 277)",
        "primary_quote_ru": "«Все составные вещи непостоянны: когда мудростью видишь это, отвращаешься от страдания — вот путь к очищению» (Дхаммапада, 277).",
    },
    "hinduism": {
        "orig_script": "सनातन धर्म (Санатана-Дхарма — «Вечный закон и порядок»)",
        "full_article_ru": (
            "Индуизм — древнейшая непрерывная религиозно-философская традиция Индийского субконтинента (~1.2 млрд последователей). "
            "Опирается на авторитет Вед и Упанишад, учение о тождестве индивидуального духовного начала (Атмана) с абсолютной реальностью Вселенной (Брахманом), круговороте перерождений (Сансара), законе воздаяния за поступки (Карма) и четырёх целях жизни (Дхарма, Артха, Кама, Мокша)."
        ),
        "primary_quote_orig": "तत् त्वम् असि (Tat Tvam Asi — Chāndogya Upaniṣad 6.8.7)",
        "primary_quote_ru": "«Тат Твам Аси — То еси ты (Атман в глубине твоего сознания един с бесконечным Брахманом)» (Чхандогья-упанишада 6.8.7).",
    },
    "judaism": {
        "orig_script": "יַהֲדוּת (Яхадут)",
        "full_article_ru": (
            "Иудаизм — древнейшая монотеистическая религия человечества и исторический корень всех авраамических религий. "
            "Основан на Письменной Торе (Пятикнижии Моисеевом в составе Танаха) и Устной Торе (Мишне и Талмуде), этическом монотеизме, святости человеческой жизни (пикуах нефеш) и Завете между Единым Богом и народом Израиля."
        ),
        "primary_quote_orig": "שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד (דברים ו׳:ד׳)",
        "primary_quote_ru": "«Слушай, Израиль: Господь — Бог наш, Господь един есть!» (Второзаконие 6:4 — молитва Шма).",
    },
}


# ==============================================================================
# 3. ПУБЛИЧНЫЕ LIVE-КАМЕРЫ ПЛАНЕТЫ ЗЕМЛЯ + ТОЧКИ GOOGLE EARTH 3D
# ==============================================================================
PUBLIC_EARTH_WEBCAMS: list[dict[str, Any]] = [
    {
        "id": "iss_nasa",
        "title": "МКС — Земля из космоса (NASA Live)",
        "city": "Низкая околоземная орбита (408 км)",
        "country": "Космос • МКС",
        "flag": "🛰️",
        "lat": 28.57,
        "lon": -80.65,
        "tz": "UTC",
        "category": "Космос",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/xRPjKQtRXR8?autoplay=1&mute=1",
        "external_cam_url": "https://www.youtube.com/results?search_query=NASA+ISS+Live+Earth+From+Space",
        "earth_3d_url": "https://earth.google.com/web/@28.5728,-80.6490,10a,12000000d,35y,0h,0t,0r",
        "desc": "Прямой эфир с бортовых HD-камер Международной космической станции: виток вокруг Земли каждые 90 минут (16 рассветов и закатов в сутки).",
    },
    {
        "id": "tokyo_shibuya",
        "title": "Токио — Перекрёсток Сибуя / Синдзюку Кабукитё",
        "city": "Токио",
        "country": "Япония",
        "flag": "🇯🇵",
        "lat": 35.6595,
        "lon": 139.7004,
        "tz": "Asia/Tokyo",
        "category": "Мегаполисы",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/gFRtAAmiFbE?autoplay=1&mute=1",
        "external_cam_url": "https://www.skylinewebcams.com/en/webcam/japan.html",
        "earth_3d_url": "https://earth.google.com/web/@35.65949,139.70055,38a,320d,35y,45h,62t,0r",
        "desc": "Неоновое сердце Токио 24/7: самый оживлённый пешеходный перекрёсток планеты и кварталы Синдзюку в реальном времени.",
    },
    {
        "id": "nyc_times_square",
        "title": "Нью-Йорк — Таймс-сквер (Манхэттен 4K)",
        "city": "Нью-Йорк",
        "country": "США",
        "flag": "🇺🇸",
        "lat": 40.7580,
        "lon": -73.9855,
        "tz": "America/New_York",
        "category": "Мегаполисы",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1",
        "external_cam_url": "https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1",
        "earth_3d_url": "https://earth.google.com/web/@40.7580,-73.9855,45a,380d,35y,28h,65t,0r",
        "desc": "Круглосуточная уличная камера EarthCam на пересечении Бродвея и 7-й авеню в центре Манхэттена.",
    },
    {
        "id": "venice_rialto",
        "title": "Венеция — Гранд-канал и мост Риальто",
        "city": "Венеция",
        "country": "Италия",
        "flag": "🇮🇹",
        "lat": 45.4380,
        "lon": 12.3359,
        "tz": "Europe/Rome",
        "category": "Европа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/ph1vpnYIxJk?autoplay=1&mute=1",
        "external_cam_url": "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande-ponte-di-rialto.html",
        "earth_3d_url": "https://earth.google.com/web/@45.43798,12.3359,12a,280d,35y,120h,64t,0r",
        "desc": "Живая панорама Гранд-канала: гондолы, вапоретто и мраморный мост Риальто XVI века со звуком воды.",
    },
    {
        "id": "namib_desert",
        "title": "Пустыня Намиб — Водопой диких животных",
        "city": "Намиб-Науклуфт",
        "country": "Намибия",
        "flag": "🇳🇦",
        "lat": -24.5189,
        "lon": 15.9394,
        "tz": "Africa/Windhoek",
        "category": "Природа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/ydYDqZQpim8?autoplay=1&mute=1",
        "external_cam_url": "https://www.youtube.com/watch?v=ydYDqZQpim8",
        "earth_3d_url": "https://earth.google.com/web/@-24.5189,15.9394,850a,1800d,35y,0h,58t,0r",
        "desc": "Знаменитая автономная камера на солнечных батареях посреди пустыни Намиб: ориксы, жирафы, зебры и страусы приходят к оазису днём и ночью.",
    },
    {
        "id": "santa_rovaniemi",
        "title": "Рованиеми — Деревня Санта-Клауса (Полярный круг)",
        "city": "Рованиеми (Лапландия)",
        "country": "Финляндия",
        "flag": "🇫🇮",
        "lat": 66.5436,
        "lon": 25.8472,
        "tz": "Europe/Helsinki",
        "category": "Европа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/Cp4RRAEgpeU?autoplay=1&mute=1",
        "external_cam_url": "https://santaclausvillage.info/arctic-circle-live-webcam/",
        "earth_3d_url": "https://earth.google.com/web/@66.5436,25.8472,115a,360d,35y,15h,60t,0r",
        "desc": "Прямая трансляция прямо с линии Северного полярного круга (66°32'35\" с.ш.) с термометром в реальном времени.",
    },
    {
        "id": "mecca_haram",
        "title": "Мекка — Заповедная мечеть Аль-Харам и Кааба",
        "city": "Мекка",
        "country": "Саудовская Аравия",
        "flag": "🇸🇦",
        "lat": 21.4225,
        "lon": 39.8262,
        "tz": "Asia/Riyadh",
        "category": "Святыни",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/7-Qf3gP0xLI?autoplay=1&mute=1",
        "external_cam_url": "https://www.skylinewebcams.com/en/webcam/saudi-arabia/makkah/mecca/grand-mosque.html",
        "earth_3d_url": "https://earth.google.com/web/@21.422487,39.826206,310a,520d,35y,40h,60t,0r",
        "desc": "Непрерывная круглосуточная трансляция тавафа вокруг Священной Каабы во внутреннем дворе мечети Аль-Харам.",
    },
    {
        "id": "swiss_alps",
        "title": "Швейцарские Альпы — Церматт и пик Маттерхорн",
        "city": "Церматт",
        "country": "Швейцария",
        "flag": "🇨🇭",
        "lat": 45.9766,
        "lon": 7.6585,
        "tz": "Europe/Zurich",
        "category": "Природа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/d8d8m6c91wA?autoplay=1&mute=1",
        "external_cam_url": "https://www.zermatt.ch/en/Webcams",
        "earth_3d_url": "https://earth.google.com/web/@45.97657,7.65845,3900a,3500d,35y,250h,68t,0r",
        "desc": "Высокогорный вид на легендарную пирамидальную вершину Маттерхорн (4478 м) на границе Швейцарии и Италии.",
    },
    {
        "id": "amsterdam_dam",
        "title": "Амстердам — Площадь Дам и каналы",
        "city": "Амстердам",
        "country": "Нидерланды",
        "flag": "🇳🇱",
        "lat": 52.3731,
        "lon": 4.8926,
        "tz": "Europe/Amsterdam",
        "category": "Европа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/Gd9d4q6WvUY?autoplay=1&mute=1",
        "external_cam_url": "https://www.webcamtaxi.com/en/netherlands/north-holland/amsterdam-dam-square.html",
        "earth_3d_url": "https://earth.google.com/web/@52.37309,4.89264,10a,340d,35y,270h,62t,0r",
        "desc": "Центральная площадь Королевского дворца в Амстердаме: трамваи, велосипедисты и старинная архитектура.",
    },
    {
        "id": "la_venice_beach",
        "title": "Лос-Анджелес — Пляж Санта-Моника / Венис-Бич",
        "city": "Лос-Анджелес",
        "country": "США",
        "flag": "🌴",
        "lat": 33.9850,
        "lon": -118.4695,
        "tz": "America/Los_Angeles",
        "category": "Природа",
        "youtube_embed": "https://www.youtube-nocookie.com/embed/vv3d6g0wX2c?autoplay=1&mute=1",
        "external_cam_url": "https://www.westland.net/beachcam/",
        "earth_3d_url": "https://earth.google.com/web/@33.9850,-118.4695,12a,450d,35y,290h,64t,0r",
        "desc": "Побережье Тихого океана в Калифорнии: пальмы, скейт-парк, сёрферы и тихоокеанские закаты.",
    },
]


# ==============================================================================
# 4. ИНТУИТИВНЫЙ ОБЩИЙ ПОИСК С СЕМАНТИЧЕСКИМ И ЭНЦИКЛОПЕДИЧЕСКИМ ФОЛЛБЭКОМ
# ==============================================================================
SLANG_AND_INTENT_ROUTES: list[tuple[tuple[str, ...], str, str]] = [
    (("член", "пенис", "писька", "болт", "елда", "размер члена", "клеш", "clash"), "party", "pencil_calc"),
    (("шахмат", "дебют", "ферз", "гамбит", "мат в", "пешк", "chess"), "arcade", "chess_academy"),
    (("шпион", "лобби", "мафия", "spy", "предател"), "arcade", "spy_lobby"),
    (("угадай размер", "guess size", "guess", "на глаз"), "arcade", "guess_size"),
    (("земля", "глобус", "google earth", "камер", "вебкам", "webcam", "спутник"), "knowledge", "earth_3d_cams"),
    (("марвел", "мстител", "паук", "железный человек", "mcu", "marvel"), "universes", "marvel_checklist"),
    (("бэтмен", "супермен", "джокер", "снайдер", "dc ", "dcu"), "universes", "dc_checklist"),
    (("майнкрафт", "зитракс", "zitraks", "ачивк", "forge", "лабубу", "сандевистан"), "universes", "zitraksmode_wiki"),
    (("конституц", "статья", "основной закон", "прав человека"), "knowledge", "constitutions_hub"),
    (("ислам", "коран", "христиан", "библия", "буддизм", "религи", "аллах", "бог"), "knowledge", "religions_hub"),
    (("водк", "алко", "бухл", "пиво", "промилл", "застоль"), "party", "vodka_calc"),
    (("гороскоп", "зодиак", "овен", "скорпион", "лев", "рыбы"), "horoscope", "daily_horoscope"),
    (("совместим", "любов", "пара"), "horoscope", "compat_calc"),
    (("физик", "скорост", "закон ома", "кпд", "мощност", "нагрев"), "physics", "phys_kinematics"),
    (("парол", "шифр", "aes", "хеш", "2fa"), "security", "pass_forge"),
    (("qr", "кьюар", "штрихкод", "ссылк"), "qr", "qr_studio"),
    (("pdf", "пдф"), "pdf", "text_to_pdf"),
]


def build_serendipity_wiki_cards(raw_query: str) -> list[dict[str, Any]]:
    """
    When a user types slang, profanity, or an open-ended word (e.g. 'хуйня', 'база', 'че почитать'),
    never dead-end: surface rich encyclopedia / world religion / constitution articles!
    """
    q_low = raw_query.strip().lower()
    profanity_or_slang = any(
        w in q_low
        for w in ("хуйн", "хуй", "пизд", "бля", "еба", "фигн", "хрен", "чо ", "че ", "скуч", "жиз", "база", "кринж", "рофл")
    )

    cards: list[dict[str, Any]] = []
    # Deterministically pick a primary featured encyclopedia article (Islam explicitly prioritized for slang/random per user request!)
    islam_meta = RELIGION_FULL_ARTICLES["islam"]
    if profanity_or_slang or not q_low:
        cards.append(
            {
                "id": "serendipity_islam",
                "kind": "Энциклопедия • Мировые религии",
                "title": "☪️ Ислам — история, 5 столпов, Коран и Золотой век науки",
                "subtitle": islam_meta["orig_script"],
                "ru_text": islam_meta["full_article_ru"] + "\n\n" + islam_meta["primary_quote_ru"],
                "orig_text": islam_meta["primary_quote_orig"],
                "orig_lang": "Арабский (القرآن)",
                "snippet": islam_meta["full_article_ru"][:320] + "…",
                "quote": islam_meta["primary_quote_ru"],
                "category_id": "knowledge",
                "tool_id": "religions_hub",
                "target_category": "knowledge",
                "target_tool": "religions_hub",
                "search_hint": "Ислам",
            }
        )

    # Add a deterministic second card based on hash of query so every random word discovers real knowledge
    digest = int(hashlib.md5(q_low.encode("utf-8")).hexdigest()[:6], 16)
    pool = [
        {
            "id": "serendipity_const_ru",
            "kind": "Конституционное право (RU + EN)",
            "title": "⚖️ Конституция РФ и США — полные статьи на русском и в оригинале",
            "subtitle": "Преамбула и базовые конституционные нормы",
            "ru_text": BILINGUAL_CONSTITUTIONS_TEXTS["RU"]["preamble_ru"]
            + "\n\n"
            + BILINGUAL_CONSTITUTIONS_TEXTS["RU"]["articles"][0]["ru"],
            "orig_text": BILINGUAL_CONSTITUTIONS_TEXTS["US"]["preamble_orig"]
            + "\n\n"
            + BILINGUAL_CONSTITUTIONS_TEXTS["US"]["articles"][0]["orig"],
            "orig_lang": "Русский / English",
            "snippet": BILINGUAL_CONSTITUTIONS_TEXTS["RU"]["preamble_ru"][:240] + "…",
            "quote": "Человек, его права и свободы являются высшей ценностью (Статья 2).",
            "category_id": "knowledge",
            "tool_id": "constitutions_hub",
            "target_category": "knowledge",
            "target_tool": "constitutions_hub",
            "search_hint": "Россия",
        },
        {
            "id": "serendipity_buddhism",
            "kind": "Энциклопедия • Восточная философия",
            "title": "☸️ Буддизм — Четыре благородные истины и природа сознания",
            "subtitle": RELIGION_FULL_ARTICLES["buddhism"]["orig_script"],
            "ru_text": RELIGION_FULL_ARTICLES["buddhism"]["full_article_ru"],
            "orig_text": RELIGION_FULL_ARTICLES["buddhism"]["primary_quote_orig"],
            "orig_lang": "Пали / Санскрит",
            "snippet": RELIGION_FULL_ARTICLES["buddhism"]["full_article_ru"][:260] + "…",
            "quote": RELIGION_FULL_ARTICLES["buddhism"]["primary_quote_ru"],
            "category_id": "knowledge",
            "tool_id": "religions_hub",
            "target_category": "knowledge",
            "target_tool": "religions_hub",
            "search_hint": "Буддизм",
        },
        {
            "id": "serendipity_earth_cams",
            "kind": "Планета Земля • Live",
            "title": "🌍 3D Земля и Публичные веб-камеры (МКС, Токио, Таймс-сквер, Мекка)",
            "subtitle": "10 круглосуточных трансляций с орбиты и континентов",
            "ru_text": "Интерактивный 3D-глобус Земли в реальном времени со спутниковым слоем и живыми трансляциями камер со всего мира.",
            "orig_text": "Live ISS HD Earth Viewing, Shibuya Crossing Tokyo, Times Square NYC, Mecca Al-Haram.",
            "orig_lang": "LIVE 3D",
            "snippet": "Интерактивный 3D-глобус Земли в реальном времени со спутниковым слоем и живыми трансляциями камер со всего мира.",
            "quote": "10 круглосуточных точек наблюдения от орбиты МКС до пустыни Намиб.",
            "category_id": "knowledge",
            "tool_id": "earth_3d_cams",
            "target_category": "knowledge",
            "target_tool": "earth_3d_cams",
            "search_hint": "",
        },
        {
            "id": "serendipity_magna_carta",
            "kind": "Исторический первоисточник (Латынь 1215 г.)",
            "title": "📜 Великая хартия вольностей (Magna Carta) — оригинал и перевод",
            "subtitle": "Статья 39 Magna Carta Libertatum (1215)",
            "ru_text": BILINGUAL_CONSTITUTIONS_TEXTS["GB"]["preamble_ru"]
            + "\n\n"
            + BILINGUAL_CONSTITUTIONS_TEXTS["GB"]["articles"][0]["ru"],
            "orig_text": BILINGUAL_CONSTITUTIONS_TEXTS["GB"]["articles"][0]["orig"],
            "orig_lang": "Латынь / English",
            "snippet": BILINGUAL_CONSTITUTIONS_TEXTS["GB"]["articles"][0]["ru"],
            "quote": BILINGUAL_CONSTITUTIONS_TEXTS["GB"]["articles"][0]["orig"],
            "category_id": "knowledge",
            "tool_id": "constitutions_hub",
            "target_category": "knowledge",
            "target_tool": "constitutions_hub",
            "search_hint": "Великобритания",
        },
    ]
    cards.append(pool[digest % len(pool)])
    cards.append(pool[(digest + 1) % len(pool)])
    return cards
