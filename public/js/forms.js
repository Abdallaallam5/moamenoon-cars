// Form definitions per category.
// Field types: text | tel | select | year | textarea | chips (multi choice)
// group: 'client' | 'car' | 'extra'
(function () {
  const o = (v, ar, en) => ({ v, ar, en });
  const f = (name, type, ar, en, extra) => Object.assign({ name, type, label: { ar, en } }, extra);

  const YEARS = (() => {
    const list = [o('any', 'أي سنة', 'Any year')];
    for (let y = new Date().getFullYear() + 1; y >= 1990; y--) list.push(o(String(y), String(y), String(y)));
    return list;
  })();

  const OPT = {
    condition: [o('new', 'جديدة', 'New'), o('used', 'مستعملة', 'Used'), o('any', 'لا يفرق', 'No preference')],
    transmission: [o('auto', 'أوتوماتيك', 'Automatic'), o('manual', 'عادي (مانيوال)', 'Manual'), o('any', 'لا يفرق', 'No preference')],
    fuel: [o('petrol', 'بنزين', 'Petrol'), o('diesel', 'ديزل', 'Diesel'), o('hybrid', 'هايبرد', 'Hybrid'), o('electric', 'كهرباء', 'Electric'), o('any', 'لا يفرق', 'No preference')],
    origin: [
      o('usa', 'أمريكا', 'USA'),
      o('europe', 'أوروبا', 'Europe'),
      o('gulf', 'الخليج', 'Gulf'),
      o('japan', 'اليابان', 'Japan'),
      o('korea', 'كوريا', 'Korea'),
      o('china', 'الصين', 'China'),
      o('any', 'أي دولة مناسبة', 'Any suitable country'),
    ],
    body: [
      o('sedan', 'سيدان', 'Sedan'),
      o('suv', 'دفع رباعي / SUV', 'SUV'),
      o('hatch', 'هاتشباك', 'Hatchback'),
      o('coupe', 'كوبيه', 'Coupe'),
      o('pickup', 'بيك أب', 'Pickup'),
      o('van', 'فان / ميني فان', 'Van / Minivan'),
    ],
    user: [o('driver', 'سيقودها بنفسه', 'Will drive it personally'), o('passenger', 'راكب (يقودها شخص آخر)', 'Passenger (someone else drives)')],
    mods: [
      o('hand', 'تحكم يدوي (فرامل وتسارع)', 'Hand controls (brake & throttle)'),
      o('lift', 'رافعة كرسي متحرك', 'Wheelchair lift'),
      o('ramp', 'منحدر لصعود الكرسي', 'Wheelchair ramp'),
      o('swivel', 'مقعد دوّار', 'Swivel seat'),
      o('leftpedal', 'دواسة تسارع يسار', 'Left-foot accelerator'),
      o('roofbox', 'حامل كرسي على السقف', 'Roof wheelchair carrier'),
      o('other', 'تجهيز آخر (اكتبه في الملاحظات)', 'Other (write in notes)'),
    ],
    kind: [
      o('heavy', 'شاحنة نقل ثقيل', 'Heavy truck'),
      o('light', 'شاحنة نقل خفيف', 'Light truck'),
      o('tipper', 'قلّاب', 'Tipper'),
      o('trailer', 'تريلا / مقطورة', 'Trailer'),
      o('mixer', 'خلّاطة خرسانة', 'Concrete mixer'),
      o('excavator', 'حفّار', 'Excavator'),
      o('loader', 'لودر', 'Loader'),
      o('bulldozer', 'بلدوزر', 'Bulldozer'),
      o('crane', 'ونش / رافعة', 'Crane'),
      o('forklift', 'رافعة شوكية (فورك ليفت)', 'Forklift'),
      o('roller', 'مدحلة', 'Road roller'),
      o('other', 'أخرى', 'Other'),
    ],
  };

  const client = [
    f('name', 'text', 'الاسم بالكامل', 'Full name', { group: 'client', required: true, ph: { ar: 'اسمك', en: 'Your name' } }),
    f('phone', 'tel', 'رقم الهاتف', 'Phone number', { group: 'client', required: true, ph: { ar: '01xxxxxxxxx', en: '01xxxxxxxxx' }, ltr: true }),
    f('city', 'text', 'المحافظة / المدينة', 'City', { group: 'client', ph: { ar: 'مثال: القاهرة', en: 'e.g. Cairo' } }),
  ];

  const budget = f('budget', 'text', 'الميزانية التقريبية', 'Approximate budget', { group: 'extra', ph: { ar: 'مثال: 800 ألف جنيه', en: 'e.g. EGP 800,000' } });
  const notes = f('notes', 'textarea', 'ملاحظات / مواصفات إضافية', 'Notes / extra specs', {
    group: 'extra',
    full: true,
    ph: { ar: 'أي تفاصيل أخرى تريد إضافتها...', en: 'Anything else you would like to add...' },
  });

  window.OPT = OPT;
  window.YEARS = YEARS;

  window.CATEGORIES = {
    import: {
      title: { ar: 'سيارات استيراد', en: 'Imported Cars' },
      carGroup: { ar: 'مواصفات السيارة', en: 'Car specifications' },
      fields: [
        ...client,
        f('brand', 'text', 'الماركة', 'Brand', { group: 'car', required: true, ph: { ar: 'مثال: مرسيدس', en: 'e.g. Mercedes' } }),
        f('model', 'text', 'الموديل', 'Model', { group: 'car', required: true, ph: { ar: 'مثال: C200', en: 'e.g. C200' } }),
        f('year', 'year', 'سنة الصنع', 'Year', { group: 'car', required: true, options: YEARS }),
        f('condition', 'select', 'الحالة', 'Condition', { group: 'car', required: true, options: OPT.condition }),
        f('origin', 'select', 'بلد الاستيراد', 'Import from', { group: 'car', options: OPT.origin }),
        f('body', 'select', 'نوع الهيكل', 'Body type', { group: 'car', options: OPT.body }),
        f('transmission', 'select', 'ناقل الحركة', 'Transmission', { group: 'car', options: OPT.transmission }),
        f('fuel', 'select', 'نوع الوقود', 'Fuel type', { group: 'car', options: OPT.fuel }),
        f('engine', 'text', 'سعة المحرك (CC)', 'Engine size (cc)', { group: 'car', ph: { ar: 'مثال: 2000', en: 'e.g. 2000' } }),
        f('color', 'text', 'اللون المطلوب', 'Preferred color', { group: 'car', ph: { ar: 'مثال: أسود', en: 'e.g. Black' } }),
        budget,
        notes,
      ],
    },

    disabled: {
      title: { ar: 'سيارات ذوي الهمم', en: 'Accessible Cars' },
      carGroup: { ar: 'مواصفات السيارة والتجهيزات', en: 'Car specs & adaptations' },
      fields: [
        ...client,
        f('user', 'select', 'من سيستخدم السيارة؟', 'Who will use the car?', { group: 'car', required: true, options: OPT.user, full: true }),
        f('mods', 'chips', 'التجهيزات المطلوبة (اختر ما يناسبك)', 'Required adaptations (select all that apply)', { group: 'car', required: true, options: OPT.mods, full: true }),
        f('brand', 'text', 'الماركة', 'Brand', { group: 'car', ph: { ar: 'مثال: هيونداي', en: 'e.g. Hyundai' } }),
        f('model', 'text', 'الموديل', 'Model', { group: 'car', ph: { ar: 'مثال: إلنترا', en: 'e.g. Elantra' } }),
        f('year', 'year', 'سنة الصنع', 'Year', { group: 'car', options: YEARS }),
        f('condition', 'select', 'الحالة', 'Condition', { group: 'car', required: true, options: OPT.condition }),
        f('transmission', 'select', 'ناقل الحركة', 'Transmission', { group: 'car', options: OPT.transmission }),
        f('fuel', 'select', 'نوع الوقود', 'Fuel type', { group: 'car', options: OPT.fuel }),
        budget,
        notes,
      ],
    },

    trucks: {
      title: { ar: 'شاحنات ومعدات', en: 'Trucks & Equipment' },
      carGroup: { ar: 'بيانات الشاحنة / المعدة', en: 'Truck / equipment details' },
      fields: [
        ...client,
        f('kind', 'select', 'النوع', 'Type', { group: 'car', required: true, options: OPT.kind }),
        f('brand', 'text', 'الماركة', 'Brand', { group: 'car', required: true, ph: { ar: 'مثال: فولفو / كاتربيلر', en: 'e.g. Volvo / Caterpillar' } }),
        f('model', 'text', 'الموديل', 'Model', { group: 'car', ph: { ar: 'مثال: FH16', en: 'e.g. FH16' } }),
        f('year', 'year', 'سنة الصنع', 'Year', { group: 'car', required: true, options: YEARS }),
        f('condition', 'select', 'الحالة', 'Condition', { group: 'car', required: true, options: OPT.condition }),
        f('capacity', 'text', 'الحمولة / القدرة', 'Capacity / power', { group: 'car', ph: { ar: 'مثال: 20 طن', en: 'e.g. 20 tons' } }),
        f('quantity', 'text', 'العدد المطلوب', 'Quantity needed', { group: 'car', ph: { ar: 'مثال: 2', en: 'e.g. 2' } }),
        budget,
        notes,
      ],
    },
  };
})();
