import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Clock,
  Cloud,
  Compass,
  Globe,
  Layers,
  MapPin,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  Search,
  Sun,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiGet } from '../../lib/api';
import {
  Vec3,
  dot3,
  latLonToVec3,
  norm3,
  project3D,
  rotateEuler,
  syncHiDPICanvas,
  useCanvasVisibility,
} from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

export interface WebcamNode {
  id: string;
  title: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  tz: string;
  category: string;
  youtube_embed: string;
  external_cam_url: string;
  earth_3d_url: string;
  desc: string;
}

const FALLBACK_CAMS: WebcamNode[] = [
  {
    id: 'moscow_city',
    title: 'Москва — Москва-Сити и Набережная',
    city: 'Москва',
    country: 'Россия',
    flag: '🇷🇺',
    lat: 55.7495,
    lon: 37.5371,
    tz: 'Europe/Moscow',
    category: 'Россия',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=m/s&zoom=11&overlay=radar&product=ecmwf&level=surface&lat=55.75&lon=37.54',
    external_cam_url: 'https://www.geocam.ru/in/moscow/',
    earth_3d_url: 'https://earth.google.com/web/@55.7495,37.5371,160a,950d,35y,45h,65t,0r',
    desc: 'Деловой центр Москва-Сити, излучина Москвы-реки и метеорадар столицы в реальном времени.',
  },
  {
    id: 'spb_nevsky',
    title: 'Санкт-Петербург — Дворцовая набережная и Нева',
    city: 'Санкт-Петербург',
    country: 'Россия',
    flag: '🇷🇺',
    lat: 59.9406,
    lon: 30.3138,
    tz: 'Europe/Moscow',
    category: 'Россия',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=wind&product=ecmwf&lat=59.94&lon=30.31',
    external_cam_url: 'https://vpiter.com/web-camera-admiralteyskaya-nab/',
    earth_3d_url: 'https://earth.google.com/web/@59.9406,30.3138,18a,650d,35y,120h,64t,0r',
    desc: 'Акватория Невы, Эрмитаж, стрелка Васильевского острова и разводные мосты Петербурга.',
  },
  {
    id: 'sochi_rosa',
    title: 'Сочи — Роза Пик (2320 м, Кавказские горы)',
    city: 'Сочи / Роза Хутор',
    country: 'Россия',
    flag: '🏔️',
    lat: 43.6251,
    lon: 40.3112,
    tz: 'Europe/Moscow',
    category: 'Россия',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=temp&product=ecmwf&lat=43.625&lon=40.311',
    external_cam_url: 'https://rosakhutor.ru/about/webcams/',
    earth_3d_url: 'https://earth.google.com/web/@43.6251,40.3112,2320a,2400d,35y,160h,68t,0r',
    desc: 'Панорама Главного Кавказского хребта с вершины Роза Пик на высоте 2320 м.',
  },
  {
    id: 'baikal_listvyanka',
    title: 'Озеро Байкал — Листвянка и исток Ангары',
    city: 'Байкал',
    country: 'Россия',
    flag: '🌊',
    lat: 51.8505,
    lon: 104.8885,
    tz: 'Asia/Irkutsk',
    category: 'Россия',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=9&overlay=wind&product=ecmwf&lat=51.85&lon=104.89',
    external_cam_url: 'https://baikal-ayan.ru/webcam',
    earth_3d_url: 'https://earth.google.com/web/@51.8505,104.8885,460a,3800d,35y,95h,62t,0r',
    desc: 'Самое глубокое озеро планеты (1642 м) и незамерзающий исток Ангары.',
  },
  {
    id: 'vladivostok_bridge',
    title: 'Владивосток — Золотой Рог и Русский мост',
    city: 'Владивосток',
    country: 'Россия',
    flag: '🇷🇺',
    lat: 43.1056,
    lon: 131.8735,
    tz: 'Asia/Vladivostok',
    category: 'Россия',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=wind&product=ecmwf&lat=43.106&lon=131.874',
    external_cam_url: 'https://podryad.tv/gorodskie-kamery',
    earth_3d_url: 'https://earth.google.com/web/@43.1056,131.8735,45a,1450d,35y,150h,66t,0r',
    desc: 'Бухта Золотой Рог, вантовый Золотой мост и тихоокеанские ворота России.',
  },
  {
    id: 'iss_nasa',
    title: 'МКС — Земля из космоса (Орбита 408 км)',
    city: 'Орбита Земли',
    country: 'Космос • МКС',
    flag: '🛰️',
    lat: 28.57,
    lon: -80.65,
    tz: 'UTC',
    category: 'Космос',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/xRPjKQtRXR8?autoplay=1&mute=1',
    external_cam_url: 'https://eol.jsc.nasa.gov/ESRS/HDEV/',
    earth_3d_url: 'https://earth.google.com/web/@28.5728,-80.6490,10a,12000000d,35y,0h,0t,0r',
    desc: 'Виток вокруг Земли каждые 90 минут (27 600 км/ч, 16 рассветов и закатов в сутки).',
  },
  {
    id: 'tokyo_shibuya',
    title: 'Токио — Перекрёсток Сибуя и Синдзюку',
    city: 'Токио',
    country: 'Япония',
    flag: '🇯🇵',
    lat: 35.6595,
    lon: 139.7004,
    tz: 'Asia/Tokyo',
    category: 'Мегаполисы',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/dfVK7ld38Ys?autoplay=1&mute=1',
    external_cam_url: 'https://www.skylinewebcams.com/en/webcam/japan.html',
    earth_3d_url: 'https://earth.google.com/web/@35.65949,139.70055,38a,320d,35y,45h,62t,0r',
    desc: 'Самый оживлённый пешеходный перекрёсток планеты и неоновые кварталы Токио 24/7.',
  },
  {
    id: 'nyc_times_square',
    title: 'Нью-Йорк — Таймс-сквер (Манхэттен)',
    city: 'Нью-Йорк',
    country: 'США',
    flag: '🇺🇸',
    lat: 40.758,
    lon: -73.9855,
    tz: 'America/New_York',
    category: 'Мегаполисы',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1',
    external_cam_url: 'https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1',
    earth_3d_url: 'https://earth.google.com/web/@40.7580,-73.9855,45a,380d,35y,28h,65t,0r',
    desc: 'Круглосуточная панорама пересечения Бродвея и 7-й авеню в центре Манхэттена.',
  },
  {
    id: 'dubai_marina',
    title: 'Дубай — Бурдж-Халифа (828 м) и Dubai Marina',
    city: 'Дубай',
    country: 'ОАЭ',
    flag: '🇦🇪',
    lat: 25.1972,
    lon: 55.2744,
    tz: 'Asia/Dubai',
    category: 'Мегаполисы',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=temp&product=ecmwf&lat=25.197&lon=55.274',
    external_cam_url: 'https://www.skylinewebcams.com/en/webcam/united-arab-emirates/dubai.html',
    earth_3d_url: 'https://earth.google.com/web/@25.1972,55.2744,180a,1200d,35y,40h,68t,0r',
    desc: 'Самый высокий небоскрёб планеты (828 м), поющие фонтаны и искусственные острова Персидского залива.',
  },
  {
    id: 'frankfurt_skyline',
    title: 'Франкфурт-на-Майне — Майнхэттен',
    city: 'Франкфурт',
    country: 'Германия',
    flag: '🇩🇪',
    lat: 50.1109,
    lon: 8.6821,
    tz: 'Europe/Berlin',
    category: 'Европа',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=radar&product=ecmwf&lat=50.11&lon=8.68',
    external_cam_url: 'https://www.frankfurt.de/sixcms/detail.php?id=2944',
    earth_3d_url: 'https://earth.google.com/web/@50.1109,8.6821,115a,920d,35y,60h,64t,0r',
    desc: 'Финансовая столица Германии на реке Майн и крупнейший интернет-узел Европы DE-CIX.',
  },
  {
    id: 'paris_eiffel',
    title: 'Париж — Эйфелева башня и Сена',
    city: 'Париж',
    country: 'Франция',
    flag: '🇫🇷',
    lat: 48.8584,
    lon: 2.2945,
    tz: 'Europe/Paris',
    category: 'Европа',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=radar&product=ecmwf&lat=48.858&lon=2.295',
    external_cam_url: 'https://www.parisinfo.com/',
    earth_3d_url: 'https://earth.google.com/web/@48.8584,2.2945,140a,720d,35y,130h,65t,0r',
    desc: 'Марсово поле, Трокадеро и панорама исторического центра Парижа.',
  },
  {
    id: 'venice_rialto',
    title: 'Венеция — Гранд-канал и мост Риальто',
    city: 'Венеция',
    country: 'Италия',
    flag: '🇮🇹',
    lat: 45.438,
    lon: 12.3359,
    tz: 'Europe/Rome',
    category: 'Европа',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/ph1vpnYIxJk?autoplay=1&mute=1',
    external_cam_url:
      'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande-ponte-di-rialto.html',
    earth_3d_url: 'https://earth.google.com/web/@45.43798,12.3359,12a,280d,35y,120h,64t,0r',
    desc: 'Гондолы, вапоретто и мраморный мост Риальто XVI века в сердце Венеции.',
  },
  {
    id: 'swiss_alps',
    title: 'Швейцарские Альпы — Церматт и Маттерхорн',
    city: 'Церматт',
    country: 'Швейцария',
    flag: '🇨🇭',
    lat: 45.9766,
    lon: 7.6585,
    tz: 'Europe/Zurich',
    category: 'Природа',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=snowcover&product=ecmwf&lat=45.977&lon=7.658',
    external_cam_url: 'https://www.zermatt.ch/en/Webcams',
    earth_3d_url: 'https://earth.google.com/web/@45.97657,7.65845,3900a,3500d,35y,250h,68t,0r',
    desc: 'Пирамидальная вершина Маттерхорн (4478 м) на границе Швейцарии и Италии.',
  },
  {
    id: 'iceland_reykjavik',
    title: 'Исландия — Рейкьявик и вулканы Рейкьянеса',
    city: 'Рейкьявик',
    country: 'Исландия',
    flag: '🇮🇸',
    lat: 63.8833,
    lon: -22.4333,
    tz: 'Atlantic/Reykjavik',
    category: 'Природа',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=9&overlay=wind&product=ecmwf&lat=63.88&lon=-22.43',
    external_cam_url: 'https://livefromiceland.is/',
    earth_3d_url: 'https://earth.google.com/web/@63.8833,-22.4333,240a,2600d,35y,20h,64t,0r',
    desc: 'Зона разлома тектонических плит, лавовые поля, гейзеры и северное сияние.',
  },
  {
    id: 'namib_desert',
    title: 'Пустыня Намиб — Оазис диких животных',
    city: 'Намиб',
    country: 'Намибия',
    flag: '🇳🇦',
    lat: -24.5189,
    lon: 15.9394,
    tz: 'Africa/Windhoek',
    category: 'Природа',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/ydYDqZQpim8?autoplay=1&mute=1',
    external_cam_url: 'https://www.youtube.com/watch?v=ydYDqZQpim8',
    earth_3d_url: 'https://earth.google.com/web/@-24.5189,15.9394,850a,1800d,35y,0h,58t,0r',
    desc: 'Ориксы, жирафы, зебры и страусы у водопоя посреди красных дюн Намиба.',
  },
  {
    id: 'santa_rovaniemi',
    title: 'Рованиеми — Полярный круг (Лапландия)',
    city: 'Рованиеми',
    country: 'Финляндия',
    flag: '🇫🇮',
    lat: 66.5436,
    lon: 25.8472,
    tz: 'Europe/Helsinki',
    category: 'Европа',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/Cp4RRAEgpeU?autoplay=1&mute=1',
    external_cam_url: 'https://santaclausvillage.info/arctic-circle-live-webcam/',
    earth_3d_url: 'https://earth.google.com/web/@66.5436,25.8472,115a,360d,35y,15h,60t,0r',
    desc: 'Линия Северного полярного круга 66°32′35″ с.ш. с живым термометром Лапландии.',
  },
  {
    id: 'sydney_harbour',
    title: 'Сидней — Опера и мост Харбор-Бридж',
    city: 'Сидней',
    country: 'Австралия',
    flag: '🇦🇺',
    lat: -33.8568,
    lon: 151.2153,
    tz: 'Australia/Sydney',
    category: 'Мегаполисы',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=wind&product=ecmwf&lat=-33.857&lon=151.215',
    external_cam_url: 'https://webcamsydney.com/',
    earth_3d_url: 'https://earth.google.com/web/@-33.8568,151.2153,15a,750d,35y,240h,65t,0r',
    desc: 'Залив Порт-Джексон, паруса Сиднейской оперы и паромное движение Южного полушария.',
  },
  {
    id: 'rio_copacabana',
    title: 'Рио-де-Жанейро — Копакабана и Сахарная Голова',
    city: 'Рио-де-Жанейро',
    country: 'Бразилия',
    flag: '🇧🇷',
    lat: -22.9711,
    lon: -43.1822,
    tz: 'America/Sao_Paulo',
    category: 'Мегаполисы',
    youtube_embed:
      'https://embed.windy.com/embed.html?type=map&location=coordinates&metricTemp=°C&zoom=11&overlay=temp&product=ecmwf&lat=-22.97&lon=-43.18',
    external_cam_url:
      'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana.html',
    earth_3d_url: 'https://earth.google.com/web/@-22.9711,-43.1822,25a,1400d,35y,35h,66t,0r',
    desc: 'Атлантический океан, пляж Копакабана и гранитные купола залива Гуанабара.',
  },
];

// Subdivide polygon edges so long coastlines curve smoothly along the spherical surface
function subdivideCoastline(pts: [number, number][], maxStepDeg = 4.5): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const [la1, lo1] = pts[i];
    const [la2, lo2] = pts[(i + 1) % pts.length];
    let dLon = lo2 - lo1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = la2 - la1;
    const dist = Math.hypot(dLat, dLon);
    const steps = Math.max(1, Math.min(18, Math.ceil(dist / maxStepDeg)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      let lon = lo1 + dLon * t;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      out.push([la1 + dLat * t, lon]);
    }
  }
  return out;
}

// Well-formed hemisphere-safe coastline polygons (North UP, South DOWN)
const RAW_CONTINENT_POLYGONS: { name: string; biome: string; border?: string; pts: [number, number][] }[] = [
  {
    name: 'North America',
    biome: 'rgba(34, 158, 96, 0.78)',
    pts: [
      [71, -166], [70, -152], [69, -138], [71, -125], [74, -95], [70, -78], [63, -78], [58, -68],
      [60, -64], [53, -56], [47, -53], [45, -61], [44, -66], [41, -70], [39, -74], [35, -75],
      [31, -81], [25, -80], [28, -83], [30, -89], [28, -96], [22, -98], [19, -96], [21, -87],
      [16, -88], [14, -83], [9, -83], [8, -78], [15, -93], [17, -101], [23, -106], [23, -110],
      [31, -114], [33, -117], [38, -123], [46, -124], [49, -126], [55, -133], [59, -140], [61, -150],
      [55, -163], [60, -166], [65, -168],
    ],
  },
  {
    name: 'South America',
    biome: 'rgba(22, 168, 82, 0.80)',
    pts: [
      [11, -75], [12, -71], [10, -62], [6, -54], [2, -50], [-2, -44], [-5, -35], [-10, -36],
      [-15, -39], [-23, -42], [-28, -49], [-35, -54], [-38, -58], [-43, -64], [-48, -66], [-54, -68],
      [-55, -71], [-50, -75], [-42, -74], [-33, -72], [-24, -70], [-18, -71], [-12, -77], [-5, -81],
      [1, -80], [6, -77],
    ],
  },
  {
    name: 'Europe & West Russia',
    biome: 'rgba(42, 165, 104, 0.78)',
    pts: [
      [36, -9], [43, -9], [44, -2], [48, -5], [51, 2], [54, 8], [57, 10], [55, 13], [60, 5],
      [64, 10], [69, 18], [71, 28], [69, 38], [67, 41], [69.5, 58], [68, 62], [52, 62], [47, 52],
      [42, 48], [41, 41], [45, 36], [46, 31], [41, 29], [37, 27], [38, 23], [40, 20], [45, 13],
      [41, 17], [38, 15], [43, 10], [43, 5], [41, 2], [36, -5],
    ],
  },
  {
    name: 'Asia & Siberia',
    biome: 'rgba(40, 158, 100, 0.78)',
    pts: [
      [69.5, 58], [73, 70], [76, 95], [77.5, 105], [73.5, 125], [71, 145], [69, 170], [66, 179],
      [62, 178], [60, 163], [51.5, 157], [58, 152], [54, 141], [45, 136], [40, 128], [35, 129],
      [38, 125], [39, 119], [35, 120], [31, 122], [25, 119], [22, 114], [20, 107], [13, 109],
      [9, 105], [13, 101], [2, 103], [7, 99], [16, 97], [22, 91], [16, 81], [8, 77.5], [19, 73],
      [24, 68], [25, 57], [29, 49], [24, 55], [16, 53], [13, 44], [20, 39], [29, 34], [36, 36],
      [37, 27], [41, 29], [41, 41], [42, 48], [47, 52], [52, 62], [68, 62],
    ],
  },
  {
    name: 'Africa',
    biome: 'rgba(134, 172, 64, 0.80)',
    pts: [
      [35.5, -6], [37, 10], [33, 12], [31, 20], [31.5, 32], [28, 34], [20, 38], [12, 43], [12, 51],
      [5, 48], [-2, 41], [-10, 40], [-18, 37], [-25, 33], [-30, 31], [-34.5, 25], [-34.2, 18.5],
      [-28, 16], [-18, 12], [-9, 13], [-4, 10], [4, 9], [6, 3], [5, -4], [4.5, -8], [10, -14],
      [15, -17], [21, -17], [28, -13], [32, -10],
    ],
  },
  {
    name: 'Sahara & Arabian Desert',
    biome: 'rgba(222, 178, 92, 0.48)',
    border: 'rgba(253, 224, 71, 0.16)',
    pts: [
      [30, -10], [31, 10], [29, 31], [28, 46], [21, 55], [16, 48], [17, 36], [16, 18], [17, -2], [22, -14],
    ],
  },
  {
    name: 'Tibetan Plateau & Himalayas',
    biome: 'rgba(226, 232, 240, 0.36)',
    border: 'rgba(241, 245, 249, 0.24)',
    pts: [
      [36, 74], [38, 86], [35, 98], [29, 96], [28, 85], [31, 77],
    ],
  },
  {
    name: 'Australia',
    biome: 'rgba(202, 138, 64, 0.82)',
    pts: [
      [-12, 131], [-11, 136], [-15, 136], [-16, 141], [-11, 142], [-18, 146], [-24, 152],
      [-28, 153], [-34, 151], [-38, 149], [-38, 141], [-35, 136], [-32, 132], [-34, 122],
      [-34, 115], [-26, 113], [-21, 114], [-18, 122], [-14, 127],
    ],
  },
  {
    name: 'Greenland',
    biome: 'rgba(226, 240, 252, 0.85)',
    pts: [
      [60, -44], [64, -40], [69, -25], [75, -19], [82, -24], [83, -42], [79, -65], [76, -70],
      [70, -54], [64, -52],
    ],
  },
  // Antarctica split into 4 clean sectors around the South Pole (-90° S at bottom!)
  {
    name: 'Antarctica West',
    biome: 'rgba(224, 242, 254, 0.82)',
    pts: [[-64, -60], [-72, -75], [-75, -110], [-76, -150], [-88, -150], [-88, -60]],
  },
  {
    name: 'Antarctica Maud',
    biome: 'rgba(224, 242, 254, 0.82)',
    pts: [[-74, -60], [-75, -30], [-70, 0], [-69, 30], [-88, 30], [-88, -60]],
  },
  {
    name: 'Antarctica East',
    biome: 'rgba(224, 242, 254, 0.82)',
    pts: [[-69, 30], [-68, 70], [-66.5, 105], [-67, 135], [-88, 135], [-88, 30]],
  },
  {
    name: 'Antarctica Ross',
    biome: 'rgba(224, 242, 254, 0.82)',
    pts: [[-67, 135], [-72, 170], [-77, 179], [-88, 179], [-88, 135]],
  },
  // Major World Islands & Peninsulas
  { name: 'Great Britain', biome: 'rgba(45, 180, 108, 0.84)', pts: [[50, -5], [51, 1.4], [54, 0], [58.5, -3], [58, -6], [54, -4]] },
  { name: 'Ireland', biome: 'rgba(34, 197, 94, 0.85)', pts: [[51.5, -10], [52, -6], [55.2, -6], [54.5, -9.8]] },
  { name: 'Iceland', biome: 'rgba(165, 220, 205, 0.86)', pts: [[63.5, -23], [64, -14], [66.4, -15], [66, -23.5]] },
  { name: 'Novaya Zemlya', biome: 'rgba(205, 230, 245, 0.82)', pts: [[70.5, 53], [73, 56], [76.8, 68], [76.2, 62], [72, 52]] },
  { name: 'Svalbard', biome: 'rgba(226, 238, 250, 0.84)', pts: [[77, 14], [78, 22], [80, 24], [79.8, 12]] },
  { name: 'Japan Honshu/Hokkaido', biome: 'rgba(52, 188, 118, 0.86)', pts: [[31, 130], [34, 135], [35.5, 140.5], [40.5, 141.5], [44.2, 145], [43, 140], [37.5, 137], [34, 131]] },
  { name: 'Sakhalin', biome: 'rgba(56, 170, 110, 0.82)', pts: [[54.2, 142.5], [49, 144], [46, 143], [50, 142]] },
  { name: 'Madagascar', biome: 'rgba(65, 172, 96, 0.84)', pts: [[-12, 49.2], [-16, 50], [-25.2, 47], [-25, 44], [-17, 44]] },
  { name: 'Sumatra', biome: 'rgba(34, 178, 96, 0.84)', pts: [[5.5, 95.5], [1, 102], [-5.5, 105.5], [-4, 102], [2, 98]] },
  { name: 'Java', biome: 'rgba(34, 178, 96, 0.84)', pts: [[-6, 105.5], [-7, 110], [-8, 114.5], [-8.5, 111], [-7, 106.5]] },
  { name: 'Borneo', biome: 'rgba(28, 168, 90, 0.85)', pts: [[7, 117], [4, 118.5], [-3.2, 116], [-3, 111], [1, 109], [4, 114]] },
  { name: 'Philippines', biome: 'rgba(42, 184, 104, 0.84)', pts: [[18.3, 121], [14, 123.5], [7, 126.2], [6, 122], [13, 120]] },
  { name: 'New Guinea', biome: 'rgba(32, 172, 88, 0.85)', pts: [[-1, 131], [-3, 141], [-9.5, 148], [-9, 141], [-5, 135]] },
  { name: 'New Zealand North', biome: 'rgba(52, 190, 114, 0.86)', pts: [[-35, 173], [-38, 178], [-41.3, 175], [-39, 174]] },
  { name: 'New Zealand South', biome: 'rgba(52, 190, 114, 0.86)', pts: [[-41.5, 173], [-43.5, 172.8], [-46.5, 168], [-45, 167]] },
  { name: 'Tasmania', biome: 'rgba(52, 174, 100, 0.82)', pts: [[-40.8, 145], [-41, 148], [-43.5, 147], [-42.5, 145.2]] },
  { name: 'Sri Lanka', biome: 'rgba(42, 180, 100, 0.85)', pts: [[9.8, 80], [7.5, 81.8], [6, 80.5], [8, 79.8]] },
  { name: 'Taiwan', biome: 'rgba(45, 186, 106, 0.86)', pts: [[25.2, 121.5], [23.5, 121.5], [22, 120.8], [24, 120.3]] },
  { name: 'Cuba', biome: 'rgba(45, 184, 104, 0.84)', pts: [[23, -84], [22.5, -79], [20, -74.5], [20, -77.5], [22, -83]] },
];

// Inland Seas & Great Lakes for crisp geographical recognition
const RAW_INLAND_SEAS: { name: string; pts: [number, number][] }[] = [
  { name: 'Black Sea', pts: [[46.2, 30.5], [46, 38], [41.5, 41.5], [41.2, 29], [44, 28.5]] },
  { name: 'Caspian Sea', pts: [[47, 48], [46.5, 53], [41, 53.5], [36.8, 53.5], [37.5, 49], [42, 48]] },
  { name: 'Lake Baikal', pts: [[55.6, 109.5], [53.5, 108.5], [51.5, 104.2], [53, 106.5]] },
  { name: 'Great Lakes', pts: [[48.8, -89], [46.5, -84], [43, -78], [41.8, -83], [43, -87.5], [47, -91]] },
];

const CONTINENT_POLYGONS = RAW_CONTINENT_POLYGONS.map((c) => ({
  ...c,
  subPts: subdivideCoastline(c.pts, 4.5),
}));

const INLAND_SEAS = RAW_INLAND_SEAS.map((s) => ({
  ...s,
  subPts: subdivideCoastline(s.pts, 3.0),
}));

// Major world agglomerations that glow on the night side of Earth
const NIGHT_CITY_HUBS: [number, number, number][] = [
  [55.75, 37.62, 1.3], [59.94, 30.31, 1.0], [55.0, 82.9, 0.8], [56.84, 60.6, 0.85], [43.11, 131.88, 0.75],
  [51.51, -0.12, 1.25], [48.86, 2.35, 1.2], [50.11, 8.68, 1.05], [52.52, 13.4, 1.0], [40.42, -3.7, 0.95],
  [41.9, 12.5, 0.95], [41.01, 28.97, 1.15], [30.04, 31.24, 1.2], [25.2, 55.27, 1.1], [24.71, 46.67, 0.95],
  [28.61, 77.21, 1.3], [19.08, 72.88, 1.25], [39.9, 116.4, 1.3], [31.23, 121.47, 1.35], [22.32, 114.17, 1.2],
  [37.56, 126.97, 1.2], [35.68, 139.76, 1.4], [13.75, 100.5, 1.05], [1.35, 103.82, 1.05], [-6.2, 106.85, 1.1],
  [-33.86, 151.21, 1.0], [40.71, -74.01, 1.4], [41.88, -87.63, 1.15], [34.05, -118.24, 1.25],
  [19.43, -99.13, 1.25], [-23.55, -46.63, 1.3], [-34.6, -58.38, 1.1], [6.52, 3.38, 1.05], [-26.2, 28.04, 0.95],
];

const GEO_LABELS: { text: string; lat: number; lon: number; color: string }[] = [
  { text: 'ЕВРАЗИЯ', lat: 56, lon: 78, color: 'rgba(226,232,240,0.46)' },
  { text: 'ЕВРОПА', lat: 49, lon: 14, color: 'rgba(226,232,240,0.44)' },
  { text: 'СЕВ. АМЕРИКА', lat: 46, lon: -102, color: 'rgba(226,232,240,0.46)' },
  { text: 'ЮЖ. АМЕРИКА', lat: -15, lon: -58, color: 'rgba(226,232,240,0.46)' },
  { text: 'АФРИКА', lat: 8, lon: 21, color: 'rgba(226,232,240,0.46)' },
  { text: 'АВСТРАЛИЯ', lat: -25, lon: 134, color: 'rgba(226,232,240,0.46)' },
  { text: 'ТИХИЙ ОКЕАН', lat: 6, lon: -155, color: 'rgba(125,211,252,0.34)' },
  { text: 'АТЛАНТИКА', lat: 24, lon: -38, color: 'rgba(125,211,252,0.34)' },
  { text: 'ИНДИЙСКИЙ ОКЕАН', lat: -18, lon: 78, color: 'rgba(125,211,252,0.34)' },
];

const WORLD_CLOCK_ZONES = [
  { city: 'Москва', flag: '🇷🇺', tz: 'Europe/Moscow', lon: 37.62 },
  { city: 'Екатеринбург', flag: '🇷🇺', tz: 'Asia/Yekaterinburg', lon: 60.6 },
  { city: 'Владивосток', flag: '🇷🇺', tz: 'Asia/Vladivostok', lon: 131.88 },
  { city: 'Лондон', flag: '🇬🇧', tz: 'Europe/London', lon: -0.12 },
  { city: 'Франкфурт', flag: '🇩🇪', tz: 'Europe/Berlin', lon: 8.68 },
  { city: 'Дубай', flag: '🇦🇪', tz: 'Asia/Dubai', lon: 55.27 },
  { city: 'Нью-Йорк', flag: '🇺🇸', tz: 'America/New_York', lon: -74.01 },
  { city: 'Токио', flag: '🇯🇵', tz: 'Asia/Tokyo', lon: 139.76 },
];

function getRealtimeSatelliteSources(lon: number): { urls: string[]; satellite: string } {
  if (lon >= -135 && lon <= -25) {
    return {
      urls: [
        'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/678x678.jpg',
        'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57723/globe_west_540.jpg',
      ],
      satellite: 'NOAA GOES-16 GeoColor (Америка и Атлантика • Live)',
    };
  }
  if (lon < -135 || lon >= 100) {
    return {
      urls: [
        'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/678x678.jpg',
        'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57723/globe_east_540.jpg',
      ],
      satellite: 'NOAA GOES-18 GeoColor (Тихий океан и Восточная Азия • Live)',
    };
  }
  return {
    urls: [
      'https://eumetview.eumetsat.int/static-images/latestImages/EUMETSAT_MSG_RGBNatColourEnhncd_LowResolution.jpg',
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57723/globe_east_540.jpg',
    ],
    satellite: 'Meteosat / NASA Blue Marble (Евразия, Россия, Европа и Африка)',
  };
}

function getSolarSubpoint(customUtcHour: number | null): { declDeg: number; subLonDeg: number; utcHours: number } {
  const now = new Date();
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear) / 86_400_000);
  const declDeg = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours =
    customUtcHour !== null
      ? customUtcHour
      : now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  let subLonDeg = (12 - utcHours) * 15;
  while (subLonDeg > 180) subLonDeg -= 360;
  while (subLonDeg < -180) subLonDeg += 360;
  return { declDeg, subLonDeg, utcHours };
}

export const EarthWebcams3D: React.FC<{ initialSearch?: string; focusSunTime?: boolean }> = ({
  initialSearch = '',
  focusSunTime = false,
}) => {
  const [cams, setCams] = useState<WebcamNode[]>(FALLBACK_CAMS);
  const [selectedId, setSelectedId] = useState<string>('moscow_city');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<'globe3d' | 'satellite'>('globe3d');
  const [playerChannel, setPlayerChannel] = useState<'windy' | 'satellite_img' | 'osm' | 'video'>('windy');
  const [satFallbackIdx, setSatFallbackIdx] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [localClock, setLocalClock] = useState('');

  // Layer toggles & Live Solar Time control
  const [showClouds, setShowClouds] = useState(true);
  const [showDayNight, setShowDayNight] = useState(true);
  const [showIssOrbit, setShowIssOrbit] = useState(true);
  const [showSunPanel, setShowSunPanel] = useState<boolean>(focusSunTime);
  const [manualUtcHour, setManualUtcHour] = useState<number | null>(null);

  useEffect(() => {
    setShowSunPanel(focusSunTime);
  }, [focusSunTime]);

  const { wrapRef, visible: active } = useCanvasVisibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam3dRef = useRef({
    rx: (55.75 * Math.PI) / 180,
    ry: (-37.54 * Math.PI) / 180,
    targetRx: (55.75 * Math.PI) / 180,
    targetRy: (-37.54 * Math.PI) / 180,
    zoom: 1.42,
    down: false,
    lx: 0,
    ly: 0,
    moved: false,
  });
  const hitMarkersRef = useRef<{ id: string; sx: number; sy: number; r: number; z: number }[]>([]);
  const layerOptsRef = useRef({ showClouds, showDayNight, showIssOrbit, manualUtcHour });
  layerOptsRef.current = { showClouds, showDayNight, showIssOrbit, manualUtcHour };

  useEffect(() => {
    if (initialSearch) setQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    let mounted = true;
    apiGet<{ items?: WebcamNode[] }>('/api/v2/knowledge/webcams?q=')
      .then((res) => {
        if (mounted && Array.isArray(res?.items) && res.items.length > 0) {
          // Merge backend webcams with extra curated nodes so nothing is missing
          const byId = new Map<string, WebcamNode>();
          for (const item of res.items) byId.set(item.id, item);
          for (const fb of FALLBACK_CAMS) {
            if (!byId.has(fb.id)) byId.set(fb.id, fb);
          }
          setCams(Array.from(byId.values()));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(['ALL']);
    cams.forEach((c) => set.add(c.category));
    return Array.from(set);
  }, [cams]);

  const filteredCams = useMemo(() => {
    return cams.filter((c) => {
      const catOk = regionFilter === 'ALL' || c.category === regionFilter;
      const q = query.trim().toLowerCase();
      const qOk =
        !q ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [cams, regionFilter, query]);

  const selectedCam = useMemo(
    () => cams.find((c) => c.id === selectedId) || filteredCams[0] || cams[0] || FALLBACK_CAMS[0],
    [cams, filteredCams, selectedId]
  );

  useEffect(() => {
    setSatFallbackIdx(0);
  }, [selectedCam.id]);

  // Smooth Fly-To camera target: ry = -lon, rx = +lat keeps North strictly UP and brings city to center!
  useEffect(() => {
    if (!selectedCam) return;
    cam3dRef.current.targetRy = (-selectedCam.lon * Math.PI) / 180;
    cam3dRef.current.targetRx = Math.max(-1.22, Math.min(1.22, (selectedCam.lat * Math.PI) / 180));
  }, [selectedCam]);

  // Live local clock at selected location
  useEffect(() => {
    const updateClock = () => {
      try {
        const fmt = new Intl.DateTimeFormat('ru-RU', {
          timeZone: selectedCam.tz || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: 'short',
        });
        setLocalClock(fmt.format(new Date()));
      } catch {
        setLocalClock(new Date().toUTCString().slice(17, 25) + ' UTC');
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [selectedCam]);

  // 3D Globe Renderer (North UP, Horizon Limb Projection, Day/Night Terminator & City Lights)
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !active || viewMode !== 'globe3d') return;
    let raf = 0;
    let tick = 0;

    const render = () => {
      const { ctx, W, H } = syncHiDPICanvas(cvs);
      if (!ctx || W < 20 || H < 20) {
        raf = requestAnimationFrame(render);
        return;
      }
      tick += 0.012;
      const st = cam3dRef.current;
      const opts = layerOptsRef.current;

      if (!st.down) {
        if (autoRotate) {
          st.ry += 0.0014;
          st.targetRy = st.ry;
        } else {
          let diffY = st.targetRy - st.ry;
          while (diffY > Math.PI) diffY -= Math.PI * 2;
          while (diffY < -Math.PI) diffY += Math.PI * 2;
          st.ry += diffY * 0.09;
          st.rx += (st.targetRx - st.rx) * 0.09;
        }
      }

      ctx.clearRect(0, 0, W, H);

      // Deep space background + Milky Way band
      const spaceBg = ctx.createRadialGradient(W * 0.5, H * 0.5, 18, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
      spaceBg.addColorStop(0, 'rgba(14,116,144,0.2)');
      spaceBg.addColorStop(0.55, 'rgba(7,15,34,0.68)');
      spaceBg.addColorStop(1, 'rgba(2,6,23,0.98)');
      ctx.fillStyle = spaceBg;
      ctx.fillRect(0, 0, W, H);

      // Crisp procedural starfield
      for (let i = 0; i < 72; i++) {
        const sx = (((i * 173 + 29) % 997) / 997) * W;
        const sy = (((i * 311 + 71) % 991) / 991) * H;
        const tw = 0.24 + 0.56 * Math.abs(Math.sin(tick * 0.95 + i));
        ctx.fillStyle = i % 6 === 0 ? `rgba(186,230,253,${tw})` : `rgba(226,232,240,${tw * 0.82})`;
        ctx.fillRect(sx, sy, i % 5 === 0 ? 1.8 : 1.2, i % 5 === 0 ? 1.8 : 1.2);
      }

      const radius = Math.min(1.88, 1.08 * st.zoom);
      const fov = Math.min(W, H) * 0.92;
      const camDist = 3.55;

      // Exact perspective horizon limb of sphere of radius `radius` viewed from (0, 0, camDist)
      const zLimb = Math.min(radius * 0.92, (radius * radius) / camDist);
      const rLimb = Math.sqrt(Math.max(1e-4, radius * radius - zLimb * zLimb));

      const centerP = project3D({ x: 0, y: 0, z: 0 }, W, H, fov, camDist);
      const limbEdgeP = project3D({ x: rLimb, y: 0, z: zLimb }, W, H, fov, camDist);
      const screenRadius = Math.max(42, Math.abs(limbEdgeP.sx - centerP.sx));

      // Project a world-rotated point onto the visible sphere or smoothly onto the circular horizon limb
      const projectSphereOrLimb = (wp: Vec3) => {
        if (wp.z >= zLimb) {
          return project3D(wp, W, H, fov, camDist);
        }
        const xy = Math.hypot(wp.x, wp.y) || 1e-5;
        return project3D(
          {
            x: (wp.x / xy) * rLimb,
            y: (wp.y / xy) * rLimb,
            z: zLimb,
          },
          W,
          H,
          fov,
          camDist
        );
      };

      // Outer Rayleigh atmospheric halo
      const atmo = ctx.createRadialGradient(
        centerP.sx,
        centerP.sy,
        screenRadius * 0.88,
        centerP.sx,
        centerP.sy,
        screenRadius * 1.22
      );
      atmo.addColorStop(0, 'rgba(56,189,248,0)');
      atmo.addColorStop(0.5, 'rgba(56,189,248,0.32)');
      atmo.addColorStop(1, 'rgba(14,165,233,0)');
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius * 1.22, 0, Math.PI * 2);
      ctx.fill();

      // Solar direction vector in rotated camera space
      const sun = getSolarSubpoint(opts.manualUtcHour);
      const sunWorld = norm3(rotateEuler(latLonToVec3(sun.declDeg, sun.subLonDeg, 1), st.rx, st.ry));

      // Ocean sphere body with bathymetry depth gradient
      const specOffX = centerP.sx + sunWorld.x * screenRadius * 0.34;
      const specOffY = centerP.sy - sunWorld.y * screenRadius * 0.34;
      const ocean = ctx.createRadialGradient(specOffX, specOffY, screenRadius * 0.06, centerP.sx, centerP.sy, screenRadius);
      ocean.addColorStop(0, '#0ea5e9');
      ocean.addColorStop(0.38, '#0284c7');
      ocean.addColorStop(0.76, '#075985');
      ocean.addColorStop(1, '#042342');
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.clip();

      // Latitude parallels (including Equator 0° and Polar Circles ±66.5°)
      for (const lat of [-75, -66.5, -45, -23.4, 0, 23.4, 45, 66.5, 75]) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < zLimb) {
            started = false;
            continue;
          }
          const pp = project3D(wp, W, H, fov, camDist);
          if (!started) {
            ctx.moveTo(pp.sx, pp.sy);
            started = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        const isEq = lat === 0;
        const isPolar = Math.abs(lat) === 66.5;
        ctx.strokeStyle = isEq
          ? 'rgba(125,211,252,0.42)'
          : isPolar
          ? 'rgba(186,230,253,0.22)'
          : 'rgba(125,211,252,0.12)';
        if (isPolar) ctx.setLineDash([3, 3]);
        ctx.lineWidth = isEq ? 1.25 : 0.75;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Longitude meridians (Greenwich 0° highlighted)
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath();
        let started = false;
        for (let lat = -85; lat <= 85; lat += 5) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < zLimb) {
            started = false;
            continue;
          }
          const pp = project3D(wp, W, H, fov, camDist);
          if (!started) {
            ctx.moveTo(pp.sx, pp.sy);
            started = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.strokeStyle = lon === 0 ? 'rgba(253,224,71,0.28)' : 'rgba(125,211,252,0.1)';
        ctx.lineWidth = lon === 0 ? 1.0 : 0.7;
        ctx.stroke();
      }

      // Continents, Islands, Deserts & Ice Caps with exact spherical horizon limb projection
      for (const cont of CONTINENT_POLYGONS) {
        const wPts = cont.subPts.map(([la, lo]) => rotateEuler(latLonToVec3(la, lo, radius * 1.002), st.rx, st.ry));
        const frontCount = wPts.filter((p) => p.z > zLimb + 0.012).length;
        if (frontCount < 2) continue;

        ctx.beginPath();
        let pen = false;
        for (const wp of wPts) {
          const pp = projectSphereOrLimb(wp);
          if (!pen) {
            ctx.moveTo(pp.sx, pp.sy);
            pen = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.closePath();
        ctx.fillStyle = cont.biome;
        ctx.fill();
        ctx.strokeStyle = cont.border || 'rgba(167,243,208,0.62)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // Inland Seas & Great Lakes (Black Sea, Caspian Sea, Baikal, Great Lakes)
      for (const sea of INLAND_SEAS) {
        const wPts = sea.subPts.map(([la, lo]) => rotateEuler(latLonToVec3(la, lo, radius * 1.003), st.rx, st.ry));
        if (wPts.filter((p) => p.z > zLimb + 0.02).length < 3) continue;
        ctx.beginPath();
        wPts.forEach((wp, idx) => {
          const pp = projectSphereOrLimb(wp);
          if (idx === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        });
        ctx.closePath();
        ctx.fillStyle = '#064e78';
        ctx.fill();
        ctx.strokeStyle = 'rgba(125,211,252,0.45)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      // Subtle continent & ocean labels on front face
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (const lbl of GEO_LABELS) {
        const wp = rotateEuler(latLonToVec3(lbl.lat, lbl.lon, radius * 1.01), st.rx, st.ry);
        if (wp.z > radius * 0.48) {
          const pp = project3D(wp, W, H, fov, camDist);
          ctx.fillStyle = lbl.color;
          ctx.fillText(lbl.text, pp.sx, pp.sy);
        }
      }
      ctx.textAlign = 'left';

      // Day/Night Astronomical Solar Terminator + Golden Night City Lights
      if (opts.showDayNight) {
        const sun2dLen = Math.hypot(sunWorld.x, sunWorld.y) || 0.001;
        const dirX = sunWorld.x / sun2dLen;
        const dirY = -sunWorld.y / sun2dLen; // screen Y is inverted relative to world +Y
        const shift = sunWorld.z * screenRadius * 0.55;
        const nightGrad = ctx.createLinearGradient(
          centerP.sx + dirX * screenRadius + dirX * shift,
          centerP.sy + dirY * screenRadius + dirY * shift,
          centerP.sx - dirX * screenRadius + dirX * shift,
          centerP.sy - dirY * screenRadius + dirY * shift
        );
        nightGrad.addColorStop(0, 'rgba(255,250,220,0.07)');
        nightGrad.addColorStop(0.46, 'rgba(2,6,23,0)');
        nightGrad.addColorStop(0.58, 'rgba(2,6,23,0.45)');
        nightGrad.addColorStop(1, 'rgba(2,6,23,0.76)');
        ctx.fillStyle = nightGrad;
        ctx.fillRect(centerP.sx - screenRadius, centerP.sy - screenRadius, screenRadius * 2, screenRadius * 2);

        // Golden Night City Lights on nocturnal hemisphere
        for (const [cLat, cLon, weight] of NIGHT_CITY_HUBS) {
          const wp = rotateEuler(latLonToVec3(cLat, cLon, radius * 1.005), st.rx, st.ry);
          if (wp.z <= zLimb + 0.03) continue;
          const nrm = norm3(wp);
          const sunDot = dot3(nrm, sunWorld);
          if (sunDot < 0.08) {
            const nightFactor = Math.min(1, (0.08 - sunDot) * 3.4);
            const pp = project3D(wp, W, H, fov, camDist);
            const glowR = (2.6 + weight * 1.9) * (st.zoom * 0.72);
            const cg = ctx.createRadialGradient(pp.sx, pp.sy, 0.4, pp.sx, pp.sy, glowR);
            cg.addColorStop(0, `rgba(254,240,138,${0.92 * nightFactor})`);
            cg.addColorStop(0.45, `rgba(251,191,36,${0.55 * nightFactor})`);
            cg.addColorStop(1, 'rgba(245,158,11,0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, glowR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ISS Orbital ground track (51.6° inclination)
      if (opts.showIssOrbit) {
        ctx.beginPath();
        let issStarted = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const lat = 51.6 * Math.sin(((lon + tick * 22) * Math.PI) / 180);
          const wp = rotateEuler(latLonToVec3(lat, lon, radius * 1.042), st.rx, st.ry);
          if (wp.z < zLimb + 0.02) {
            issStarted = false;
            continue;
          }
          const pp = project3D(wp, W, H, fov, camDist);
          if (!issStarted) {
            ctx.moveTo(pp.sx, pp.sy);
            issStarted = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.strokeStyle = 'rgba(250,204,21,0.34)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.15;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Subtle atmospheric cloud wisps
      if (opts.showClouds) {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 2.4;
        for (let band = 0; band < 6; band++) {
          const cLat = -48 + band * 19;
          const cLonStart = ((band * 63 + tick * 4.2) % 360) - 180;
          ctx.beginPath();
          let pen = false;
          for (let step = 0; step < 14; step++) {
            const wp = rotateEuler(
              latLonToVec3(cLat + Math.sin(step + band) * 3.2, cLonStart + step * 4.6, radius * 1.016),
              st.rx,
              st.ry
            );
            if (wp.z <= zLimb + 0.06) {
              pen = false;
              continue;
            }
            const pp = project3D(wp, W, H, fov, camDist);
            if (!pen) {
              ctx.moveTo(pp.sx, pp.sy);
              pen = true;
            } else {
              ctx.lineTo(pp.sx, pp.sy);
            }
          }
          ctx.stroke();
        }
      }

      ctx.restore();

      // Planet rim highlight
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,211,252,0.65)';
      ctx.lineWidth = 1.45;
      ctx.stroke();

      // North Pole (+90° N at TOP) & South Pole (-90° S at BOTTOM) 3D Axis Beacons
      const poles: { lat: number; label: string; col: string }[] = [
        { lat: 90, label: '⬆ N 90° Север', col: '#38bdf8' },
        { lat: -90, label: '⬇ S 90° Юг', col: '#cbd5e1' },
      ];
      for (const pole of poles) {
        const pBase = rotateEuler(latLonToVec3(pole.lat, 0, radius), st.rx, st.ry);
        const pTip = rotateEuler(latLonToVec3(pole.lat, 0, radius * 1.09), st.rx, st.ry);
        if (pTip.z > -0.15) {
          const bProj = project3D(pBase, W, H, fov, camDist);
          const tProj = project3D(pTip, W, H, fov, camDist);
          ctx.beginPath();
          ctx.moveTo(bProj.sx, bProj.sy);
          ctx.lineTo(tProj.sx, tProj.sy);
          ctx.strokeStyle = pole.col;
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.fillStyle = pole.col;
          ctx.fillText(pole.label, tProj.sx + 5, tProj.sy + (pole.lat > 0 ? -2 : 10));
        }
      }

      // Interactive Webcam Pins on 3D Globe
      const hits: { id: string; sx: number; sy: number; r: number; z: number }[] = [];
      const sortedCams = filteredCams
        .map((cam) => {
          const alt = cam.id === 'iss_nasa' ? radius * 1.11 : radius * 1.015;
          const wp = rotateEuler(latLonToVec3(cam.lat, cam.lon, alt), st.rx, st.ry);
          const pp = project3D(wp, W, H, fov, camDist);
          return { cam, wp, pp };
        })
        .sort((a, b) => a.wp.z - b.wp.z);

      for (const item of sortedCams) {
        if (item.wp.z < zLimb - 0.02 || !item.pp.visible) continue;
        const isSel = item.cam.id === selectedCam.id;
        const pulseR = isSel ? 8 + Math.sin(tick * 4) * 2.8 : 5;

        if (isSel) {
          ctx.beginPath();
          ctx.arc(item.pp.sx, item.pp.sy, pulseR + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250,204,21,0.75)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(item.pp.sx, item.pp.sy, isSel ? 5.6 : 4.2, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#facc15' : item.cam.category === 'Россия' ? '#38bdf8' : '#34d399';
        ctx.fill();
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (isSel || item.wp.z > radius * 0.56) {
          ctx.font = isSel ? '700 11px Inter, sans-serif' : '600 10px Inter, sans-serif';
          const lbl = `${item.cam.flag} ${item.cam.city}`;
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = isSel ? 'rgba(15,23,42,0.92)' : 'rgba(2,6,23,0.72)';
          ctx.fillRect(item.pp.sx + 7, item.pp.sy - 9, tw + 8, 16);
          ctx.fillStyle = isSel ? '#fef08a' : '#e2e8f0';
          ctx.fillText(lbl, item.pp.sx + 11, item.pp.sy + 3);
        }

        hits.push({
          id: item.cam.id,
          sx: item.pp.sx,
          sy: item.pp.sy,
          r: 18,
          z: item.wp.z,
        });
      }
      hitMarkersRef.current = hits;

      // Top-Left Compass Rose HUD (confirms North is UP)
      const compX = 28;
      const compY = 28;
      ctx.fillStyle = 'rgba(15,23,42,0.82)';
      ctx.beginPath();
      ctx.arc(compX, compY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(compX, compY - 11);
      ctx.lineTo(compX - 4, compY + 1);
      ctx.lineTo(compX + 4, compY + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(compX, compY + 11);
      ctx.lineTo(compX - 4, compY + 1);
      ctx.lineTo(compX + 4, compY + 1);
      ctx.closePath();
      ctx.fill();
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#bae6fd';
      ctx.fillText('N ↑ Север', 52, 26);
      const centerLatDeg = Math.round((st.rx * 180) / Math.PI);
      let centerLonDeg = Math.round((-st.ry * 180) / Math.PI) % 360;
      if (centerLonDeg > 180) centerLonDeg -= 360;
      if (centerLonDeg < -180) centerLonDeg += 360;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `${Math.abs(centerLatDeg)}°${centerLatDeg >= 0 ? 'N' : 'S'}  ${Math.abs(centerLonDeg)}°${centerLonDeg >= 0 ? 'E' : 'W'}`,
        52,
        38
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, viewMode, autoRotate, filteredCams, selectedCam]);

  const handleGlobeTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const wasMoved = cam3dRef.current.moved;
    cam3dRef.current.down = false;
    if (wasMoved) return;

    const rect = cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const candidates = hitMarkersRef.current
      .filter((h) => Math.hypot(x - h.sx, y - h.sy) <= h.r)
      .sort((a, b) => b.z - a.z);
    if (candidates[0]) {
      setSelectedId(candidates[0].id);
      setAutoRotate(false);
    }
  };

  const osmEmbedUrl = useMemo(() => {
    const d = 0.035;
    const bbox = `${(selectedCam.lon - d).toFixed(4)}%2C${(selectedCam.lat - d).toFixed(4)}%2C${(
      selectedCam.lon + d
    ).toFixed(4)}%2C${(selectedCam.lat + d).toFixed(4)}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${selectedCam.lat.toFixed(
      4
    )}%2C${selectedCam.lon.toFixed(4)}`;
  }, [selectedCam]);

  const windyLiveUrl = useMemo(() => {
    return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=m/s&zoom=10&overlay=radar&product=ecmwf&level=surface&lat=${selectedCam.lat.toFixed(
      3
    )}&lon=${selectedCam.lon.toFixed(3)}`;
  }, [selectedCam]);

  const liveSat = useMemo(() => getRealtimeSatelliteSources(selectedCam.lon), [selectedCam.lon]);
  const activeSatUrl = liveSat.urls[Math.min(satFallbackIdx, liveSat.urls.length - 1)];

  const sunInfo = useMemo(() => getSolarSubpoint(manualUtcHour), [manualUtcHour, localClock]);

  return (
    <div ref={wrapRef} className="rounded-2xl border border-sky-500/25 bg-slate-900/80 p-3.5 sm:p-5 space-y-4">
      {/* Header + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="earth_3d_cams" color="#0ea5e9" size={40} />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-sky-400" /> 3D Планета Земля, Терминатор и Веб-Камеры
            </h3>
            <p className="text-xs text-slate-400">
              Ориентация Север ↑ Юг ↓ • Реальная линия День/Ночь, огни мегаполисов, спутники NOAA и радар
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowSunPanel((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
              showSunPanel
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" /> Мировое время и Солнце
          </button>
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Город, страна, океан (Москва, Токио, МКС)..."
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* Collapsible / Dedicated Solar Terminator & World Time Studio */}
      {showSunPanel && (
        <div className="rounded-xl bg-slate-950/90 border border-amber-400/30 p-3.5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Солнечный зенит и симуляция времени суток на 3D-глобусе
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-300">
                Зенит Солнца: {sunInfo.declDeg.toFixed(1)}° {sunInfo.declDeg >= 0 ? 'с.ш.' : 'ю.ш.'},{' '}
                {sunInfo.subLonDeg.toFixed(1)}° {sunInfo.subLonDeg >= 0 ? 'в.д.' : 'з.д.'}
              </span>
              {manualUtcHour !== null && (
                <button
                  type="button"
                  onClick={() => setManualUtcHour(null)}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-semibold text-emerald-200"
                >
                  Вернуть LIVE UTC
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 shrink-0 font-mono">
              UTC:{' '}
              <b className="text-white">
                {String(Math.floor(sunInfo.utcHours) % 24).padStart(2, '0')}:
                {String(Math.floor((sunInfo.utcHours % 1) * 60)).padStart(2, '0')}
              </b>
            </span>
            <input
              type="range"
              min={0}
              max={23.95}
              step={0.1}
              value={sunInfo.utcHours}
              onChange={(e) => setManualUtcHour(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="text-[11px] text-slate-400 hidden sm:inline">Двигайте для смены дня и ночи</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {WORLD_CLOCK_ZONES.map((z) => {
              let timeStr = '';
              try {
                const refDate = new Date();
                if (manualUtcHour !== null) {
                  refDate.setUTCHours(Math.floor(manualUtcHour), Math.round((manualUtcHour % 1) * 60), 0, 0);
                }
                timeStr = new Intl.DateTimeFormat('ru-RU', {
                  timeZone: z.tz,
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(refDate);
              } catch {
                timeStr = '--:--';
              }
              const hourNum = Number(timeStr.split(':')[0] || 12);
              const isDay = hourNum >= 7 && hourNum < 19;
              return (
                <div
                  key={z.city}
                  className="p-2 rounded-lg bg-slate-900 border border-white/10 flex flex-col justify-between"
                >
                  <div className="text-[11px] text-slate-300 truncate">
                    {z.flag} {z.city}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-white text-xs">{timeStr}</span>
                    {isDay ? (
                      <Sun className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Split Grid: Left = 3D Interactive Earth / Map, Right = Live Telemetry & Webcam Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: 3D Globe + Map Switcher */}
        <div className="xl:col-span-7 rounded-2xl bg-slate-950/90 border border-white/10 p-3 flex flex-col justify-between space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('globe3d')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  viewMode === 'globe3d'
                    ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" /> 3D Глобус Земли
              </button>
              <button
                type="button"
                onClick={() => setViewMode('satellite')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  viewMode === 'satellite'
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" /> Карта улиц 2D
              </button>
            </div>

            {viewMode === 'globe3d' && (
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowDayNight((v) => !v)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                    showDayNight
                      ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                  title="Линия терминатора и огни ночных городов"
                >
                  🌙 Ночь/Огни
                </button>
                <button
                  type="button"
                  onClick={() => setShowClouds((v) => !v)}
                  className={`p-1.5 rounded-lg border transition ${
                    showClouds
                      ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                  title="Атмосферные облака"
                >
                  <Cloud className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.min(2.6, cam3dRef.current.zoom + 0.22);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Приблизить Землю"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.max(0.85, cam3dRef.current.zoom - 0.22);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Отдалить Землю"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoRotate((r) => !r)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Суточное вращение"
                >
                  {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = 1.42;
                    cam3dRef.current.targetRy = (-selectedCam.lon * Math.PI) / 180;
                    cam3dRef.current.targetRx = (selectedCam.lat * Math.PI) / 180;
                    setAutoRotate(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Сбросить ракурс (Север сверху)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Region Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setRegionFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                  regionFilter === cat
                    ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? '🌐 Все регионы' : cat}
              </button>
            ))}
          </div>

          {viewMode === 'globe3d' ? (
            <canvas
              ref={canvasRef}
              style={{ height: 360 }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.14 : -0.14;
                cam3dRef.current.zoom = Math.max(0.85, Math.min(2.6, cam3dRef.current.zoom + delta));
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                cam3dRef.current.down = true;
                cam3dRef.current.moved = false;
                cam3dRef.current.lx = e.clientX;
                cam3dRef.current.ly = e.clientY;
              }}
              onPointerMove={(e) => {
                if (!cam3dRef.current.down) return;
                const dx = e.clientX - cam3dRef.current.lx;
                const dy = e.clientY - cam3dRef.current.ly;
                if (Math.abs(dx) + Math.abs(dy) > 4) cam3dRef.current.moved = true;
                cam3dRef.current.lx = e.clientX;
                cam3dRef.current.ly = e.clientY;
                cam3dRef.current.ry += dx * 0.0068;
                cam3dRef.current.targetRy = cam3dRef.current.ry;
                // Dragging down (dy > 0) tilts northern hemisphere down into view; clamped to [-80°, +80°] so poles never flip upside-down!
                cam3dRef.current.rx = Math.max(-1.38, Math.min(1.38, cam3dRef.current.rx + dy * 0.0068));
                cam3dRef.current.targetRx = cam3dRef.current.rx;
              }}
              onPointerUp={handleGlobeTap}
              onPointerCancel={() => {
                cam3dRef.current.down = false;
              }}
              className="w-full rounded-xl bg-[#030712] border border-sky-500/20 cursor-grab active:cursor-grabbing touch-none block"
            />
          ) : (
            <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-900" style={{ height: 360 }}>
              <iframe title={selectedCam.title} src={osmEmbedUrl} className="w-full h-full border-0" loading="lazy" />
            </div>
          )}

          {/* Location Switcher Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
            {filteredCams.map((c) => {
              const activeCam = c.id === selectedCam.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setAutoRotate(false);
                  }}
                  className={`p-2 rounded-xl border text-left transition ${
                    activeCam
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {c.flag} {c.city}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{c.country}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Multi-Channel Resilient Live Telemetry & Webcam Player */}
        <div className="xl:col-span-5 rounded-2xl bg-slate-950/90 border border-amber-500/25 p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ПРЯМАЯ СВОДКА ЛОКАЦИИ • LIVE
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white mt-1.5">
                  {selectedCam.flag} {selectedCam.title}
                </h4>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-400">Местное время</div>
                <div className="text-xs font-mono font-bold text-amber-300">{localClock}</div>
              </div>
            </div>

            {/* 4 Resilient Feed Switcher Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPlayerChannel('windy')}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                  playerChannel === 'windy'
                    ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> Радар Live
              </button>
              <button
                type="button"
                onClick={() => setPlayerChannel('satellite_img')}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                  playerChannel === 'satellite_img'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" /> Спутник
              </button>
              <button
                type="button"
                onClick={() => setPlayerChannel('osm')}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                  playerChannel === 'osm'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> Карта
              </button>
              <button
                type="button"
                onClick={() => setPlayerChannel('video')}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                  playerChannel === 'video'
                    ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Поток
              </button>
            </div>

            {/* Live Player Viewport */}
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative" style={{ height: 260 }}>
              {playerChannel === 'windy' && (
                <iframe
                  key={`windy-${selectedCam.id}`}
                  src={windyLiveUrl}
                  title={`${selectedCam.title} Live Radar`}
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              )}
              {playerChannel === 'satellite_img' && (
                <div className="w-full h-full flex flex-col items-center justify-between bg-slate-950 p-2">
                  <img
                    src={activeSatUrl}
                    alt={liveSat.satellite}
                    onError={() => {
                      if (satFallbackIdx + 1 < liveSat.urls.length) {
                        setSatFallbackIdx((i) => i + 1);
                      } else {
                        setPlayerChannel('windy');
                      }
                    }}
                    className="max-h-[210px] object-contain rounded-lg border border-white/10"
                  />
                  <div className="text-[10px] text-sky-300 font-mono truncate w-full text-center">
                    {liveSat.satellite}
                  </div>
                </div>
              )}
              {playerChannel === 'osm' && (
                <iframe
                  key={`osm-${selectedCam.id}`}
                  src={osmEmbedUrl}
                  title={`${selectedCam.title} Map`}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              )}
              {playerChannel === 'video' && (
                <iframe
                  key={`video-${selectedCam.id}`}
                  src={selectedCam.youtube_embed || windyLiveUrl}
                  title={selectedCam.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{selectedCam.desc}</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                {Math.abs(selectedCam.lat).toFixed(4)}° {selectedCam.lat >= 0 ? 'с.ш.' : 'ю.ш.'},{' '}
                {Math.abs(selectedCam.lon).toFixed(4)}° {selectedCam.lon >= 0 ? 'в.д.' : 'з.д.'}
              </span>
              <span>{selectedCam.tz}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={selectedCam.external_cam_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-semibold text-amber-100 flex items-center justify-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" /> Уличные камеры города
              </a>
              <a
                href={selectedCam.earth_3d_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-semibold text-sky-200 flex items-center justify-center gap-1.5 transition"
              >
                <Layers className="w-3.5 h-3.5" /> В Google Earth 3D
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
