// Cấu hình sự kiện chính - có thể thay đổi dễ dàng
export interface Event {
  id: string
  name: string
  title: string
  description: string
  bannerImage: string
  date: string
  location: string
  price: string
  featured: boolean
  details?: {
    about?: string
    highlights?: string[]
    image?: string
  }
}

export const featuredEvent: Event = {
  id: 'anh-trai-say-hi',
  name: 'Anh Trai Say Hi',
  title: 'ANH TRAI "SAY HI"',
  description: 'Sự kiện âm nhạc đặc biệt với không gian hiện đại và công nghệ blockchain',
  bannerImage: '/src/public/atraic2.png',
  date: '2024 - Sắp diễn ra',
  location: 'Hà Nội, Việt Nam',
  price: 'Từ 500.000 VNĐ',
  featured: true,
  details: {
    about: 'Anh Trai "Say Hi" là sự kiện âm nhạc độc đáo kết hợp giữa nghệ thuật hiện đại và công nghệ blockchain. Sự kiện mang đến trải nghiệm hoàn toàn mới với không gian được thiết kế đặc biệt, âm thanh chất lượng cao và hệ thống vé điện tử được bảo mật trên blockchain.',
    highlights: [
      'Không gian hiện đại với công nghệ ánh sáng tiên tiến',
      'Âm thanh chất lượng studio',
      'Hệ thống vé blockchain minh bạch và an toàn',
      'Nhiều nghệ sĩ nổi tiếng tham gia',
      'Trải nghiệm độc đáo với công nghệ AR/VR'
    ],
    image: '/src/public/atraic2.png'
  }
}

// Danh sách sự kiện nổi bật
export const featuredEvents: Event[] = [
  featuredEvent,
  {
    id: 'music-festival-2024',
    name: 'Music Festival 2024',
    title: 'MUSIC FESTIVAL 2024',
    description: 'Lễ hội âm nhạc lớn nhất năm với nhiều nghệ sĩ quốc tế',
    bannerImage: '/src/public/atraic2.png',
    date: '15/03/2024',
    location: 'TP.HCM, Việt Nam',
    price: 'Từ 800.000 VNĐ',
    featured: true,
    details: {
      about: 'Music Festival 2024 là sự kiện âm nhạc quy mô lớn nhất trong năm, quy tụ hàng trăm nghệ sĩ nổi tiếng từ trong và ngoài nước. Sự kiện mang đến trải nghiệm âm nhạc đa dạng với nhiều thể loại từ pop, rock, EDM đến jazz và classical.',
      highlights: [
        'Hơn 50 nghệ sĩ quốc tế và trong nước',
        'Sân khấu đa cấp với công nghệ LED hiện đại',
        'Hệ thống âm thanh Dolby Atmos chuyên nghiệp',
        'Khu vực VIP với view độc quyền',
        'Food court đa dạng với ẩm thực từ nhiều quốc gia'
      ],
      image: '/src/public/atraic2.png'
    }
  },
  {
    id: 'bts-world-tour 2026',
    name: 'BTS WORLD TOUR 2026',
    title: 'BTS WORLD TOUR 2026',
    description: 'BTS WORLD TOUR 2026 là hàng trăm người hâm mộ của BTS đến từ khắp nơi trên thế giới để tham gia sự kiện',
    bannerImage: '/src/public/atraic2.png',
    date: '20/04/2026',
    location: 'Sân vận động Mỹ Đình, Hà Nội',
    price: 'Từ 1.200.000 VNĐ',
    featured: true,
    details: {
      about: 'BTS WORLD TOUR 2026 là hàng trăm người hâm mộ của BTS đến từ khắp nơi trên thế giới để tham gia sự kiện',
      highlights: [
        'Sân khấu đa cấp với công nghệ LED hiện đại',
        'Hệ thống âm thanh Dolby Atmos chuyên nghiệp',
        'Khu vực VIP với view độc quyền',
        'Food court đa dạng với ẩm thực từ nhiều quốc gia'
      ],
    }
  },
]

export const otherEvents: Event[] = [
  {
    id: 'event-3',
    name: 'Art Exhibition',
    title: 'Contemporary Art Exhibition',
    description: 'Triển lãm nghệ thuật đương đại với các tác phẩm độc đáo',
    bannerImage: '/src/public/atraic2.png',
    date: '10/05/2024',
    location: 'Hà Nội',
    price: 'Từ 300.000 VNĐ',
    featured: false
  }
]

// Sự kiện xu hướng - Trending Events
export const trendingEvents: Event[] = [
  {
    id: 'trending-1',
    name: 'BLACKPINK World Tour',
    title: 'BLACKPINK BORN PINK WORLD TOUR',
    description: 'Concert hoành tráng của nhóm nhạc nữ hàng đầu thế giới',
    bannerImage: '/src/public/atraic2.png',
    date: '28/01/2026',
    location: 'Sân vận động Mỹ Đình, Hà Nội',
    price: 'Từ 1.500.000 VNĐ',
    featured: false,
    details: {
      about: 'BLACKPINK mang đến tour diễn thế giới với những ca khúc hit đình đám',
      highlights: [
        'Sân khấu hoành tráng với công nghệ LED 360 độ',
        'Âm thanh Dolby Atmos chuẩn quốc tế',
        'Meet & Greet với nghệ sĩ (VIP)',
        'Merchandise độc quyền'
      ]
    }
  },
  {
    id: 'trending-2',
    name: 'Sơn Tùng M-TP Sky Tour',
    title: 'SKY TOUR 2026 - SƠN TÙNG M-TP',
    description: 'Concert âm nhạc hoành tráng nhất năm của Sơn Tùng M-TP',
    bannerImage: '/src/public/atraic2.png',
    date: '15/02/2026',
    location: 'Sân vận động Quốc gia Mỹ Đình',
    price: 'Từ 800.000 VNĐ',
    featured: false,
    details: {
      about: 'Sky Tour trở lại với quy mô lớn hơn, hoành tráng hơn',
      highlights: [
        'Sân khấu 3D mapping độc đáo',
        'Dàn dựng với hơn 200 vũ công',
        'Phần trình diễn drone show',
        'Những ca khúc hit mới nhất'
      ]
    }
  },
  {
    id: 'trending-3',
    name: 'EDM Festival Vietnam',
    title: 'ULTRA MUSIC FESTIVAL VIETNAM 2026',
    description: 'Lễ hội EDM lớn nhất Việt Nam với các DJ hàng đầu thế giới',
    bannerImage: '/src/public/atraic2.png',
    date: '20/02/2026',
    location: 'Công viên Đầm Sen, TP.HCM',
    price: 'Từ 1.200.000 VNĐ',
    featured: false,
    details: {
      about: 'Ultra Music Festival Vietnam quy tụ những DJ hàng đầu thế giới',
      highlights: [
        'Martin Garrix, Armin van Buuren, David Guetta',
        '3 sân khấu khác nhau',
        'Light show và laser show hoành tráng',
        'Pool party khu vực VIP'
      ]
    }
  },
  {
    id: 'trending-4',
    name: 'Rap Việt Concert',
    title: 'RAP VIỆT ALL-STARS CONCERT',
    description: 'Đêm nhạc quy tụ các rapper hàng đầu từ Rap Việt',
    bannerImage: '/src/public/atraic2.png',
    date: '01/03/2026',
    location: 'Nhà thi đấu Phú Thọ, TP.HCM',
    price: 'Từ 500.000 VNĐ',
    featured: false,
    details: {
      about: 'All-stars concert với sự góp mặt của các rapper nổi tiếng nhất',
      highlights: [
        'Binz, Karik, Wowy, Rhymastic, Suboi',
        'Battle rap đặc biệt',
        'Sân khấu hip-hop chuyên nghiệp',
        'Guest performances đặc biệt'
      ]
    }
  },
  {
    id: 'trending-5',
    name: 'K-Pop Festival',
    title: 'KOREA MUSIC WAVE FESTIVAL',
    description: 'Lễ hội âm nhạc Hàn Quốc với nhiều nghệ sĩ idol',
    bannerImage: '/src/public/atraic2.png',
    date: '10/03/2026',
    location: 'Sân vận động Hàng Đẫy, Hà Nội',
    price: 'Từ 900.000 VNĐ',
    featured: false
  },
  {

    id: 'trending-6',
    name: 'K-Pop Festival',
    title: 'KOREA MUSIC WAVE FESTIVAL',
    description: 'Lễ hội âm nhạc Hàn Quốc với nhiều nghệ sĩ idol',
    bannerImage: '/src/public/atraic2.png',
    date: '10/03/2026',
    location: 'Sân vận động Hàng Đẫy, Hà Nội',
    price: 'Từ 900.000 VNĐ',
    featured: false
  }
]

// Sự kiện dành cho bạn - Recommended Events
export const recommendedEvents: Event[] = [
  {
    id: 'recommended-1',
    name: 'Stand-up Comedy',
    title: 'ĐÊM HÀI KỊCH - TRƯỜNG GIANG & BẠN',
    description: 'Đêm comedy show với những tiết mục hài độc đáo',
    bannerImage: '/src/public/atraic2.png',
    date: '25/01/2026',
    location: 'Nhà hát Hòa Bình, TP.HCM',
    price: 'Từ 300.000 VNĐ',
    featured: false
  },
  {
    id: 'recommended-2',
    name: 'Jazz Night',
    title: 'SAI GON JAZZ NIGHT',
    description: 'Đêm nhạc Jazz với các nghệ sĩ jazz hàng đầu',
    bannerImage: '/src/public/atraic2.png',
    date: '30/01/2026',
    location: 'Nhà hát Thành phố, TP.HCM',
    price: 'Từ 400.000 VNĐ',
    featured: false,
    details: {
      about: 'Đêm nhạc Jazz đẳng cấp với những giai điệu mộng mơ',
      highlights: [
        'Nghệ sĩ jazz quốc tế',
        'Không gian sang trọng',
        'Đồ uống miễn phí cho khách VIP',
        'Jazz combo live band'
      ]
    }
  },
  {
    id: 'recommended-3',
    name: 'Indie Music Festival',
    title: 'INDIE VIBES FESTIVAL 2026',
    description: 'Lễ hội âm nhạc indie với các ban nhạc underground',
    bannerImage: '/src/public/atraic2.png',
    date: '05/02/2026',
    location: 'The Factory, TP.HCM',
    price: 'Từ 250.000 VNĐ',
    featured: false
  },
  {
    id: 'recommended-4',
    name: 'Classical Concert',
    title: 'ĐÊM NHẠC CỔ ĐIỂN - BEETHOVEN SYMPHONY',
    description: 'Đêm nhạc cổ điển với dàn nhạc giao hưởng',
    bannerImage: '/src/public/atraic2.png',
    date: '12/02/2026',
    location: 'Nhà hát Lớn Hà Nội',
    price: 'Từ 500.000 VNĐ',
    featured: false,
    details: {
      about: 'Dàn nhạc giao hưởng biểu diễn các tác phẩm của Beethoven',
      highlights: [
        'Dàn nhạc giao hưởng 80 người',
        'Chỉ huy nổi tiếng từ châu Âu',
        'Âm thanh acoustics hoàn hảo',
        'Không gian sang trọng'
      ]
    }
  },
  {
    id: 'recommended-5',
    name: 'Theater Show',
    title: 'KỊCH NÓI - VỢ CHỒNG SON',
    description: 'Vở kịch nổi tiếng với dàn diễn viên tài năng',
    bannerImage: '/src/public/atraic2.png',
    date: '18/02/2026',
    location: 'Nhà hát Tuổi Trẻ, TP.HCM',
    price: 'Từ 200.000 VNĐ',
    featured: false
  }
]

// Sự kiện cuối tuần - Weekend Events (automatically filtered by date)
export const weekendEvents: Event[] = [
  {
    id: 'weekend-1',
    name: 'Weekend Market',
    title: 'CHỢ ĐÊM CUỐI TUẦN - STREET FOOD FESTIVAL',
    description: 'Chợ đêm ẩm thực với hàng trăm món ăn đặc sắc',
    bannerImage: '/src/public/atraic2.png',
    date: '25/01/2026', // Saturday
    location: 'Công viên Lê Văn Tám, TP.HCM',
    price: 'Miễn phí',
    featured: false,
    details: {
      about: 'Chợ đêm cuối tuần với ẩm thực đường phố đa dạng',
      highlights: [
        'Hơn 100 gian hàng ẩm thực',
        'Live music performances',
        'Khu vực giải trí cho trẻ em',
        'Thủ công mỹ nghệ handmade'
      ]
    }
  },
  {
    id: 'weekend-2',
    name: 'Saturday Night Live',
    title: 'SATURDAY NIGHT LIVE SHOW',
    description: 'Đêm nhạc trực tiếp với các ban nhạc địa phương',
    bannerImage: '/src/public/atraic2.png',
    date: '25/01/2026', // Saturday
    location: 'Hard Rock Cafe, TP.HCM',
    price: 'Từ 150.000 VNĐ',
    featured: false
  },
  {
    id: 'weekend-3',
    name: 'Sunday Brunch Concert',
    title: 'SUNDAY ACOUSTIC BRUNCH',
    description: 'Buổi nhạc acoustic thư giãn vào sáng chủ nhật',
    bannerImage: '/src/public/atraic2.png',
    date: '26/01/2026', // Sunday
    location: 'Saigon Outcast, TP.HCM',
    price: 'Từ 200.000 VNĐ',
    featured: false,
    details: {
      about: 'Buổi sáng chủ nhật thư giãn với âm nhạc acoustic và brunch',
      highlights: [
        'Acoustic live band',
        'Brunch buffet bao gồm trong vé',
        'Không gian outdoor chill',
        'Kids zone cho gia đình'
      ]
    }
  },
  {
    id: 'weekend-4',
    name: 'Weekend Yoga Festival',
    title: 'YOGA & WELLNESS WEEKEND',
    description: 'Lễ hội yoga và sức khỏe cuối tuần',
    bannerImage: '/src/public/atraic2.png',
    date: '26/01/2026', // Sunday
    location: 'Công viên Tao Đàn, TP.HCM',
    price: 'Từ 100.000 VNĐ',
    featured: false
  },
  {
    id: 'weekend-5',
    name: 'Film Festival Weekend',
    title: 'VIETNAM SHORT FILM FESTIVAL',
    description: 'Liên hoan phim ngắn cuối tuần',
    bannerImage: '/src/public/atraic2.png',
    date: '01/02/2026', // Saturday
    location: 'CGV Vincom, Hà Nội',
    price: 'Từ 50.000 VNĐ',
    featured: false
  }
]

// Sự kiện cuối tháng - End of Month Events
export const endOfMonthEvents: Event[] = [
  {
    id: 'endmonth-1',
    name: 'New Year Countdown',
    title: 'NEW YEAR COUNTDOWN PARTY 2026',
    description: 'Đêm nhạc đón năm mới hoành tráng',
    bannerImage: '/src/public/atraic2.png',
    date: '31/01/2026',
    location: 'Landmark 81, TP.HCM',
    price: 'Từ 800.000 VNĐ',
    featured: false,
    details: {
      about: 'Đại tiệc countdown chào năm mới với pháo hoa và âm nhạc',
      highlights: [
        'Pháo hoa rực rỡ lúc 0h',
        'DJ quốc tế biểu diễn',
        'Buffet cao cấp unlimited',
        'Cocktail miễn phí cho VIP',
        'View toàn cảnh thành phố'
      ]
    }
  },
  {
    id: 'endmonth-2',
    name: 'Month End Sale Festival',
    title: 'NGÀY HỘI MUA SẮM CUỐI THÁNG',
    description: 'Lễ hội mua sắm với giảm giá đến 80%',
    bannerImage: '/src/public/atraic2.png',
    date: '31/01/2026',
    location: 'Aeon Mall, Hà Nội',
    price: 'Miễn phí',
    featured: false
  },
  {
    id: 'endmonth-3',
    name: 'End Month Music Night',
    title: 'LIVE MUSIC FAREWELL NIGHT',
    description: 'Đêm nhạc chào tháng mới',
    bannerImage: '/src/public/atraic2.png',
    date: '28/02/2026',
    location: 'Thao Cam Vien, TP.HCM',
    price: 'Từ 200.000 VNĐ',
    featured: false,
    details: {
      about: 'Đêm nhạc đặc biệt với các nghệ sĩ nổi tiếng',
      highlights: [
        'Line-up nghệ sĩ đa dạng',
        'Food trucks & drinks',
        'Không gian outdoor lãng mạn',
        'Lucky draw với giải thưởng lớn'
      ]
    }
  },
  {
    id: 'endmonth-4',
    name: 'Art Gallery Night',
    title: 'TRIỂN LÃM NGHỆ THUẬT ĐÊM CUỐI THÁNG',
    description: 'Đêm triển lãm nghệ thuật đặc biệt',
    bannerImage: '/src/public/atraic2.png',
    date: '31/03/2026',
    location: 'VCCA, Hà Nội',
    price: 'Từ 100.000 VNĐ',
    featured: false
  },
  {
    id: 'endmonth-5',
    name: 'Charity Concert',
    title: 'CHARITY CONCERT - VÌ TRẺ EM VÙNG CAO',
    description: 'Concert từ thiện cuối tháng',
    bannerImage: '/src/public/atraic2.png',
    date: '30/04/2026',
    location: 'Nhà hát Hòa Bình, TP.HCM',
    price: 'Từ 300.000 VNĐ',
    featured: false,
    details: {
      about: 'Concert từ thiện với mục đích gây quỹ cho trẻ em vùng cao',
      highlights: [
        'Nhiều nghệ sĩ nổi tiếng tham gia',
        '100% tiền vé đi từ thiện',
        'Đấu giá các vật phẩm quý',
        'Gặp gỡ nghệ sĩ sau chương trình'
      ]
    }
  }
]

// Hàm để thay đổi sự kiện chính
export const setFeaturedEvent = (event: Event) => {
  // Có thể lưu vào localStorage hoặc state management
  return event
}
