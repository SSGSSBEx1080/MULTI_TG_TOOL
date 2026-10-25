import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Compass,
  ExternalLink,
  Globe,
  Layers,
  MapPin,
  Maximize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  Search,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiGet } from '../../lib/api';
import {
  Vec3,
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
    desc: 'Акватория Невы, Эрмитаж, стрелка Васильевского острова и мосты Петербурга.',
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

// High-detail coastline & island polygons [lat, lon] + desert/mountain biome overlays
const CONTINENT_POLYGONS: { name: string; biome: string; border?: string; pts: [number, number][] }[] = [
  {
    name: 'North America',
    biome: 'rgba(34, 150, 94, 0.72)',
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
    biome: 'rgba(22, 163, 74, 0.78)',
    pts: [
      [11, -75], [12, -71], [10, -62], [6, -54], [2, -50], [-2, -44], [-5, -35], [-10, -36],
      [-15, -39], [-23, -42], [-28, -49], [-35, -54], [-38, -58], [-43, -64], [-48, -66], [-54, -68],
      [-55, -71], [-50, -75], [-42, -74], [-33, -72], [-24, -70], [-18, -71], [-12, -77], [-5, -81],
      [1, -80], [6, -77],
    ],
  },
  {
    name: 'Europe & Eurasia',
    biome: 'rgba(42, 157, 102, 0.74)',
    pts: [
      [36, -9], [43, -9], [44, -2], [48, -5], [51, 2], [54, 8], [57, 10], [55, 13], [60, 5],
      [64, 10], [69, 18], [71, 28], [69, 38], [67, 41], [70, 58], [73, 70], [76, 95], [77, 105],
      [73, 125], [71, 145], [69, 170], [66, -171], [62, 178], [60, 163], [52, 158], [58, 152],
      [54, 142], [45, 136], [40, 128], [35, 129], [38, 125], [39, 119], [35, 120], [31, 122],
      [25, 119], [22, 114], [20, 107], [13, 109], [9, 105], [13, 101], [7, 100], [2, 103],
      [15, 98], [22, 91], [16, 81], [8, 77], [19, 73], [24, 68], [25, 57], [29, 49], [24, 55],
      [16, 53], [13, 44], [20, 39], [29, 34], [32, 35], [36, 36], [37, 27], [41, 29], [45, 34],
      [42, 41], [46, 31], [41, 26], [38, 24], [40, 20], [45, 13], [41, 17], [38, 15], [43, 10],
      [43, 5], [41, 2], [36, -5],
    ],
  },
  {
    name: 'Africa',
    biome: 'rgba(132, 168, 62, 0.76)',
    pts: [
      [35, -6], [37, 10], [33, 12], [31, 20], [32, 32], [28, 34], [20, 38], [12, 43], [12, 51],
      [5, 48], [-2, 41], [-10, 40], [-18, 37], [-25, 33], [-30, 31], [-34, 25], [-34, 18],
      [-28, 16], [-18, 12], [-9, 13], [-4, 10], [4, 9], [6, 3], [5, -4], [4, -8], [10, -14],
      [15, -17], [21, -17], [28, -13], [32, -10],
    ],
  },
  {
    name: 'Sahara & Arabian Desert',
    biome: 'rgba(217, 175, 92, 0.46)',
    border: 'rgba(253, 224, 71, 0.18)',
    pts: [
      [30, -10], [31, 10], [29, 31], [28, 46], [21, 55], [16, 48], [17, 36], [16, 18], [17, -2], [22, -14],
    ],
  },
  {
    name: 'Tibetan Plateau & Himalayas',
    biome: 'rgba(203, 213, 225, 0.34)',
    border: 'rgba(226, 232, 240, 0.25)',
    pts: [
      [36, 74], [38, 86], [35, 98], [29, 96], [28, 85], [31, 77],
    ],
  },
  {
    name: 'Australia',
    biome: 'rgba(194, 132, 62, 0.78)',
    pts: [
      [-12, 131], [-11, 136], [-15, 136], [-16, 141], [-11, 142], [-18, 146], [-24, 152],
      [-28, 153], [-34, 151], [-38, 149], [-38, 141], [-35, 136], [-32, 132], [-34, 122],
      [-34, 115], [-26, 113], [-21, 114], [-18, 122], [-14, 127],
    ],
  },
  {
    name: 'Greenland',
    biome: 'rgba(226, 238, 250, 0.8)',
    pts: [
      [60, -44], [64, -40], [69, -25], [75, -19], [82, -24], [83, -42], [79, -65], [76, -70],
      [70, -54], [64, -52],
    ],
  },
  {
    name: 'Antarctica',
    biome: 'rgba(224, 242, 254, 0.78)',
    pts: [
      [-66, -64], [-71, -74], [-74, -105], [-76, -150], [-72, 170], [-67, 140], [-66, 105],
      [-68, 70], [-69, 35], [-71, 0], [-74, -35], [-64, -58],
    ],
  },
  // Major World Islands & Archipelagos
  { name: 'Great Britain', biome: 'rgba(45, 175, 105, 0.8)', pts: [[50, -5], [51, 1], [54, 0], [58, -3], [58, -6], [54, -4]] },
  { name: 'Ireland', biome: 'rgba(34, 197, 94, 0.82)', pts: [[51.5, -10], [52, -6], [55, -6], [54.5, -9.5]] },
  { name: 'Iceland', biome: 'rgba(148, 210, 190, 0.82)', pts: [[63.5, -23], [64, -14], [66.3, -15], [66, -23]] },
  { name: 'Japan Honshu/Hokkaido', biome: 'rgba(52, 185, 118, 0.84)', pts: [[31, 130], [34, 135], [35, 140], [40, 141], [44, 145], [43, 140], [37, 137], [34, 131]] },
  { name: 'Madagascar', biome: 'rgba(65, 168, 95, 0.8)', pts: [[-12, 49], [-16, 50], [-25, 47], [-25, 44], [-17, 44]] },
  { name: 'Sumatra', biome: 'rgba(34, 175, 95, 0.8)', pts: [[5.5, 95.5], [1, 102], [-5.5, 105.5], [-4, 102], [2, 98]] },
  { name: 'Java', biome: 'rgba(34, 175, 95, 0.8)', pts: [[-6, 105.5], [-7, 110], [-8, 114.5], [-8.5, 111], [-7, 106.5]] },
  { name: 'Borneo', biome: 'rgba(28, 165, 88, 0.82)', pts: [[7, 117], [4, 118], [-3, 116], [-3, 111], [1, 109], [4, 114]] },
  { name: 'Philippines', biome: 'rgba(42, 182, 102, 0.8)', pts: [[18, 121], [14, 123], [7, 126], [6, 122], [13, 120]] },
  { name: 'New Guinea', biome: 'rgba(32, 168, 86, 0.82)', pts: [[-1, 131], [-3, 141], [-9, 148], [-9, 141], [-5, 135]] },
  { name: 'New Zealand North', biome: 'rgba(52, 188, 112, 0.84)', pts: [[-35, 173], [-38, 178], [-41.3, 175], [-39, 174]] },
  { name: 'New Zealand South', biome: 'rgba(52, 188, 112, 0.84)', pts: [[-41.5, 173], [-43.5, 172.8], [-46.5, 168], [-45, 167]] },
  { name: 'Tasmania', biome: 'rgba(52, 170, 98, 0.8)', pts: [[-40.8, 145], [-41, 148], [-43.5, 147], [-42.5, 145.2]] },
  { name: 'Sri Lanka', biome: 'rgba(42, 178, 98, 0.82)', pts: [[9.8, 80], [7.5, 81.8], [6, 80.5], [8, 79.8]] },
  { name: 'Taiwan', biome: 'rgba(45, 185, 105, 0.84)', pts: [[25.2, 121.5], [23.5, 121.5], [22, 120.8], [24, 120.3]] },
  { name: 'Cuba', biome: 'rgba(45, 182, 102, 0.82)', pts: [[23, -84], [22.5, -79], [20, -74.5], [20, -77.5], [22, -83]] },
  { name: 'Sakhalin', biome: 'rgba(56, 165, 108, 0.8)', pts: [[54, 142.5], [49, 144], [46, 143], [50, 142]] },
  { name: 'Svalbard', biome: 'rgba(226, 238, 250, 0.8)', pts: [[77, 14], [78, 22], [80, 24], [79.8, 12]] },
];

function latLonToVec3(latDeg: number, lonDeg: number, radius = 1.0): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return {
    x: radius * Math.cos(lat) * Math.sin(lon),
    y: -radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.cos(lon),
  };
}

function getRealtimeSatelliteImgUrl(lon: number): { url: string; satellite: string } {
  // Choose live geostationary meteorological satellite disc covering the target longitude!
  if (lon >= -135 && lon <= -25) {
    return {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/678x678.jpg',
      satellite: 'NOAA GOES-16 GeoColor (Америка и Атлантика • Live)',
    };
  }
  if (lon < -135 || lon >= 115) {
    return {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/678x678.jpg',
      satellite: 'NOAA GOES-18 GeoColor (Тихий океан и Восточная Азия • Live)',
    };
  }
  return {
    url: 'https://eumetview.eumetsat.int/static-images/latestImages/EUMETSAT_MSG_RGBNatColourEnhncd_LowResolution.jpg',
    satellite: 'EUMETSAT Meteosat Live (Европа, Россия, Африка и Ближний Восток)',
  };
}

export const EarthWebcams3D: React.FC<{ initialSearch?: string }> = ({ initialSearch = '' }) => {
  const [cams, setCams] = useState<WebcamNode[]>(FALLBACK_CAMS);
  const [selectedId, setSelectedId] = useState<string>('moscow_city');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<'globe3d' | 'satellite'>('globe3d');
  // Default stream channel: 'windy' works 100% globally & in Russia without YouTube blocks or dead videoIds!
  const [playerChannel, setPlayerChannel] = useState<'windy' | 'satellite_img' | 'video'>('windy');
  const [autoRotate, setAutoRotate] = useState(false);
  const [localClock, setLocalClock] = useState('');

  const { wrapRef, visible: active } = useCanvasVisibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam3dRef = useRef({
    rx: 0.72,
    ry: -0.65,
    targetRx: 0.72,
    targetRy: -0.65,
    zoom: 1.38,
    down: false,
    lx: 0,
    ly: 0,
    moved: false,
  });
  const hitMarkersRef = useRef<{ id: string; sx: number; sy: number; r: number; z: number }[]>([]);

  useEffect(() => {
    if (initialSearch) setQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    let mounted = true;
    apiGet<{ items?: WebcamNode[] }>('/api/v2/knowledge/webcams?q=')
      .then((res) => {
        if (mounted && Array.isArray(res?.items) && res.items.length > 0) {
          setCams(res.items);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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

  // Smooth Fly-To camera target whenever user picks a webcam
  useEffect(() => {
    if (!selectedCam) return;
    cam3dRef.current.targetRy = (-selectedCam.lon * Math.PI) / 180;
    cam3dRef.current.targetRx = Math.max(-1.18, Math.min(1.18, (selectedCam.lat * Math.PI) / 180));
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

  // 3D Globe Renderer
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

      if (!st.down) {
        if (autoRotate) {
          st.ry += 0.0016;
          st.targetRy = st.ry;
        } else {
          let diffY = st.targetRy - st.ry;
          while (diffY > Math.PI) diffY -= Math.PI * 2;
          while (diffY < -Math.PI) diffY += Math.PI * 2;
          st.ry += diffY * 0.085;
          st.rx += (st.targetRx - st.rx) * 0.085;
        }
      }

      ctx.clearRect(0, 0, W, H);

      // Deep space background + subtle Milky Way glow
      const spaceBg = ctx.createRadialGradient(W * 0.5, H * 0.5, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
      spaceBg.addColorStop(0, 'rgba(14,116,144,0.18)');
      spaceBg.addColorStop(0.55, 'rgba(7,15,34,0.6)');
      spaceBg.addColorStop(1, 'rgba(2,6,23,0.98)');
      ctx.fillStyle = spaceBg;
      ctx.fillRect(0, 0, W, H);

      // Crisp procedural starfield
      for (let i = 0; i < 64; i++) {
        const sx = ((i * 173 + 29) % 997) / 997 * W;
        const sy = ((i * 311 + 71) % 991) / 991 * H;
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(tick * 1.1 + i));
        ctx.fillStyle = i % 7 === 0 ? `rgba(186,230,253,${tw})` : `rgba(226,232,240,${tw * 0.8})`;
        ctx.fillRect(sx, sy, i % 5 === 0 ? 1.8 : 1.2, i % 5 === 0 ? 1.8 : 1.2);
      }

      const radius = 1.08 * st.zoom;
      const fov = Math.min(W, H) * 0.92;
      const camDist = 3.5;

      const centerP = project3D({ x: 0, y: 0, z: 0 }, W, H, fov, camDist);
      const edgeP = project3D({ x: radius, y: 0, z: 0 }, W, H, fov, camDist);
      const screenRadius = Math.max(40, Math.abs(edgeP.sx - centerP.sx));

      // Outer Rayleigh atmospheric halo
      const atmo = ctx.createRadialGradient(
        centerP.sx,
        centerP.sy,
        screenRadius * 0.86,
        centerP.sx,
        centerP.sy,
        screenRadius * 1.2
      );
      atmo.addColorStop(0, 'rgba(56,189,248,0)');
      atmo.addColorStop(0.55, 'rgba(56,189,248,0.28)');
      atmo.addColorStop(1, 'rgba(14,165,233,0)');
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Ocean sphere body with bathymetry depth gradient
      const ocean = ctx.createRadialGradient(
        centerP.sx - screenRadius * 0.32,
        centerP.sy - screenRadius * 0.32,
        screenRadius * 0.08,
        centerP.sx,
        centerP.sy,
        screenRadius
      );
      ocean.addColorStop(0, '#0284c7');
      ocean.addColorStop(0.45, '#075985');
      ocean.addColorStop(0.82, '#0c4a6e');
      ocean.addColorStop(1, '#041e3a');
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.clip();

      // Latitude / Longitude graticule + Equator & Polar Circles
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < -0.05) {
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
        ctx.strokeStyle = lat === 0 ? 'rgba(125,211,252,0.34)' : 'rgba(125,211,252,0.12)';
        ctx.lineWidth = lat === 0 ? 1.1 : 0.7;
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 6) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < -0.05) {
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
        ctx.strokeStyle = lon === 0 ? 'rgba(253,224,71,0.22)' : 'rgba(125,211,252,0.11)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Continents, Islands, Deserts & Ice Caps with coastal shelf highlight
      for (const cont of CONTINENT_POLYGONS) {
        const wPts = cont.pts.map(([la, lo]) => rotateEuler(latLonToVec3(la, lo, radius * 1.003), st.rx, st.ry));
        const visCount = wPts.filter((p) => p.z > -0.14).length;
        if (visCount < 3) continue;

        ctx.beginPath();
        let pen = false;
        for (const wp of wPts) {
          const clamped = wp.z < -0.08 ? { ...wp, z: -0.08 } : wp;
          const pp = project3D(clamped, W, H, fov, camDist);
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
        ctx.strokeStyle = cont.border || 'rgba(167,243,208,0.58)';
        ctx.lineWidth = 1.05;
        ctx.stroke();
      }

      // ISS Orbital ground track
      ctx.beginPath();
      let issStarted = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const lat = 51.6 * Math.sin(((lon + tick * 24) * Math.PI) / 180);
        const wp = rotateEuler(latLonToVec3(lat, lon, radius * 1.045), st.rx, st.ry);
        if (wp.z < 0.02) {
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
      ctx.strokeStyle = 'rgba(250,204,21,0.28)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle atmospheric cloud wisps
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2.2;
      for (let band = 0; band < 6; band++) {
        const cLat = -50 + band * 20;
        const cLonStart = ((band * 63 + tick * 4.5) % 360) - 180;
        ctx.beginPath();
        let pen = false;
        for (let step = 0; step < 14; step++) {
          const wp = rotateEuler(
            latLonToVec3(cLat + Math.sin(step + band) * 3.5, cLonStart + step * 4.8, radius * 1.018),
            st.rx,
            st.ry
          );
          if (wp.z <= 0.1) continue;
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

      // Day/Night solar terminator shading
      const nightGrad = ctx.createLinearGradient(
        centerP.sx - screenRadius,
        centerP.sy - screenRadius * 0.4,
        centerP.sx + screenRadius,
        centerP.sy + screenRadius * 0.5
      );
      nightGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
      nightGrad.addColorStop(0.64, 'rgba(2,6,23,0)');
      nightGrad.addColorStop(1, 'rgba(2,6,23,0.65)');
      ctx.fillStyle = nightGrad;
      ctx.fillRect(centerP.sx - screenRadius, centerP.sy - screenRadius, screenRadius * 2, screenRadius * 2);

      ctx.restore();

      // Planet rim highlight
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,211,252,0.6)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Interactive Webcam Pins on 3D Globe
      const hits: { id: string; sx: number; sy: number; r: number; z: number }[] = [];
      const sortedCams = filteredCams
        .map((cam) => {
          const alt = cam.id === 'iss_nasa' ? radius * 1.12 : radius * 1.016;
          const wp = rotateEuler(latLonToVec3(cam.lat, cam.lon, alt), st.rx, st.ry);
          const pp = project3D(wp, W, H, fov, camDist);
          return { cam, wp, pp };
        })
        .sort((a, b) => a.wp.z - b.wp.z);

      for (const item of sortedCams) {
        if (item.wp.z < 0.04 || !item.pp.visible) continue;
        const isSel = item.cam.id === selectedCam.id;
        const pulseR = isSel ? 8 + Math.sin(tick * 4) * 3 : 5;

        if (isSel) {
          ctx.beginPath();
          ctx.arc(item.pp.sx, item.pp.sy, pulseR + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250,204,21,0.8)';
          ctx.lineWidth = 1.7;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(item.pp.sx, item.pp.sy, isSel ? 6.2 : 4.4, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#facc15' : item.cam.category === 'Россия' ? '#38bdf8' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        if (isSel || st.zoom >= 1.18) {
          ctx.font = isSel ? '700 11px "Rubik", sans-serif' : '500 10px "Rubik", sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const text = `${item.cam.flag} ${item.cam.city}`;
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = isSel ? 'rgba(15,23,42,0.92)' : 'rgba(15,23,42,0.72)';
          ctx.fillRect(item.pp.sx + 8, item.pp.sy - 8, tw + 8, 16);
          ctx.fillStyle = isSel ? '#fde047' : '#e2e8f0';
          ctx.fillText(text, item.pp.sx + 12, item.pp.sy);
        }

        hits.push({ id: item.cam.id, sx: item.pp.sx, sy: item.pp.sy, r: 18, z: item.wp.z });
      }
      hitMarkersRef.current = hits;

      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.92)';
      ctx.textAlign = 'left';
      ctx.fillText(
        `LAT ${selectedCam.lat.toFixed(4)}°  LON ${selectedCam.lon.toFixed(4)}°  •  ZOOM ${st.zoom.toFixed(2)}x  •  ТОЧЕК: ${filteredCams.length}`,
        12,
        H - 10
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, viewMode, filteredCams, selectedCam, autoRotate]);

  const handleGlobeTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = !cam3dRef.current.moved;
    cam3dRef.current.down = false;
    if (!wasTap || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = hitMarkersRef.current
      .filter((m) => Math.hypot(cx - m.sx, cy - m.sy) <= m.r)
      .sort((a, b) => b.z - a.z)[0];
    if (hit) {
      setSelectedId(hit.id);
    }
  };

  const osmEmbedUrl = useMemo(() => {
    const d = 0.015;
    const bbox = `${selectedCam.lon - d},${selectedCam.lat - d},${selectedCam.lon + d},${selectedCam.lat + d}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${selectedCam.lat},${selectedCam.lon}`;
  }, [selectedCam]);

  // Windy Live Weather + Webcams + Satellite overlay around exact coordinates (works everywhere without VPN)
  const windyLiveUrl = useMemo(() => {
    const zoom = selectedCam.id === 'iss_nasa' ? 4 : 10;
    return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=m/s&zoom=${zoom}&overlay=radar&product=ecmwf&level=surface&lat=${selectedCam.lat.toFixed(3)}&lon=${selectedCam.lon.toFixed(3)}&detailLat=${selectedCam.lat.toFixed(3)}&detailLon=${selectedCam.lon.toFixed(3)}&marker=true`;
  }, [selectedCam]);

  const liveSat = useMemo(() => getRealtimeSatelliteImgUrl(selectedCam.lon), [selectedCam]);

  const categories = ['ALL', 'Россия', 'Европа', 'Мегаполисы', 'Природа', 'Космос'];

  return (
    <div ref={wrapRef} className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/80 border border-sky-500/25">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="earth_3d_cams" color="#0ea5e9" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              🌍 3D Планета Земля, Спутники и Веб-камеры
            </h3>
            <p className="text-[11px] text-slate-400">
              Детализированный глобус материков и островов, живой метеорадар, снимки NOAA/EUMETSAT и уличные камеры
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('globe3d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              viewMode === 'globe3d'
                ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> 3D Глобус Земли
          </button>
          <button
            type="button"
            onClick={() => setViewMode('satellite')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              viewMode === 'satellite'
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
                : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Карта улиц 1:1
          </button>
          <a
            href={selectedCam.earth_3d_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-400/40 text-indigo-200 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Google Earth 3D
          </a>
        </div>
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-2xl bg-slate-950/90 border border-white/10 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск города или страны (Москва, Сочи, Байкал, Токио, МКС, Исландия)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>
            {viewMode === 'globe3d' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.min(3.1, cam3dRef.current.zoom + 0.25);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Приблизить Землю"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.max(0.85, cam3dRef.current.zoom - 0.25);
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
                    cam3dRef.current.zoom = 1.38;
                    setAutoRotate(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Сбросить ракурс"
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
              style={{ height: 350 }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.15 : -0.15;
                cam3dRef.current.zoom = Math.max(0.85, Math.min(3.1, cam3dRef.current.zoom + delta));
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
                cam3dRef.current.ry += dx * 0.0075;
                cam3dRef.current.targetRy = cam3dRef.current.ry;
                cam3dRef.current.rx = Math.max(-1.25, Math.min(1.25, cam3dRef.current.rx + dy * 0.0075));
                cam3dRef.current.targetRx = cam3dRef.current.rx;
              }}
              onPointerUp={handleGlobeTap}
              onPointerCancel={() => {
                cam3dRef.current.down = false;
              }}
              className="w-full rounded-xl bg-[#030712] border border-sky-500/20 cursor-grab active:cursor-grabbing touch-none block"
            />
          ) : (
            <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-900" style={{ height: 350 }}>
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

            {/* 3 Resilient Feed Switcher Tabs (Fixes blocked YouTube embeds!) */}
            <div className="grid grid-cols-3 gap-1.5">
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
                <Satellite className="w-3.5 h-3.5" /> Спутник NOAA
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
                <Video className="w-3.5 h-3.5" /> Видеопоток
              </button>
            </div>

            {/* Live Player Viewport */}
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative" style={{ height: 255 }}>
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
                    src={liveSat.url}
                    alt={liveSat.satellite}
                    className="max-h-[205px] object-contain rounded-lg border border-white/10"
                  />
                  <div className="text-[10px] text-sky-300 font-mono truncate w-full text-center">
                    {liveSat.satellite}
                  </div>
                </div>
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
                {selectedCam.lat.toFixed(4)}°, {selectedCam.lon.toFixed(4)}°
              </span>
              <span>TZ: {selectedCam.tz}</span>
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
