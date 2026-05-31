import { vi as commonVi,        en as commonEn        } from "./common";
import { vi as authVi,          en as authEn          } from "./auth";
import { vi as homeVi,          en as homeEn          } from "./customer/home";
import { vi as searchVi,        en as searchEn        } from "./customer/search";
import { vi as hotelVi,         en as hotelEn         } from "./customer/hotel";
import { vi as bookingVi,       en as bookingEn       } from "./customer/booking";
import { vi as mybookingsVi,    en as mybookingsEn    } from "./customer/mybookings";
import { vi as reviewsVi,       en as reviewsEn       } from "./customer/reviews";
import { vi as partnerSignupVi, en as partnerSignupEn } from "./customer/partner-signup";

// Admin
import { vi as admSharedVi,    en as admSharedEn    } from "./admin/shared";
import { vi as admDashVi,      en as admDashEn      } from "./admin/dashboard";
import { vi as admUsersVi,     en as admUsersEn     } from "./admin/users";
import { vi as admPartnersVi,  en as admPartnersEn  } from "./admin/partners";
import { vi as admHotelsVi,    en as admHotelsEn    } from "./admin/hotels";
import { vi as admBookingsVi,  en as admBookingsEn  } from "./admin/bookings";
import { vi as admRefundsVi,   en as admRefundsEn   } from "./admin/refunds";
import { vi as admReviewsVi,   en as admReviewsEn   } from "./admin/reviews";
import { vi as admSystemVi,    en as admSystemEn    } from "./admin/system";

// Partner
import { vi as ptSharedVi,    en as ptSharedEn    } from "./partner/shared";
import { vi as ptDashVi,      en as ptDashEn      } from "./partner/dashboard";
import { vi as ptHotelsVi,    en as ptHotelsEn    } from "./partner/hotels";
import { vi as ptRoomsVi,     en as ptRoomsEn     } from "./partner/rooms";
import { vi as ptBookingsVi,  en as ptBookingsEn  } from "./partner/bookings";
import { vi as ptCalendarVi,  en as ptCalendarEn  } from "./partner/calendar";
import { vi as ptRevenueVi,   en as ptRevenueEn   } from "./partner/revenue";
import { vi as ptReviewsVi,   en as ptReviewsEn   } from "./partner/reviews";
import { vi as ptForecastVi,  en as ptForecastEn  } from "./partner/forecast";

export const vi = {
  ...commonVi,
  ...authVi,
  ...homeVi,
  ...searchVi,
  ...hotelVi,
  ...bookingVi,
  ...mybookingsVi,
  ...reviewsVi,
  ...partnerSignupVi,
  // Admin
  ...admSharedVi,
  ...admDashVi,
  ...admUsersVi,
  ...admPartnersVi,
  ...admHotelsVi,
  ...admBookingsVi,
  ...admRefundsVi,
  ...admReviewsVi,
  ...admSystemVi,
  // Partner
  ...ptSharedVi,
  ...ptDashVi,
  ...ptHotelsVi,
  ...ptRoomsVi,
  ...ptBookingsVi,
  ...ptCalendarVi,
  ...ptRevenueVi,
  ...ptReviewsVi,
  ...ptForecastVi,
};

export const en = {
  ...commonEn,
  ...authEn,
  ...homeEn,
  ...searchEn,
  ...hotelEn,
  ...bookingEn,
  ...mybookingsEn,
  ...reviewsEn,
  ...partnerSignupEn,
  // Admin
  ...admSharedEn,
  ...admDashEn,
  ...admUsersEn,
  ...admPartnersEn,
  ...admHotelsEn,
  ...admBookingsEn,
  ...admRefundsEn,
  ...admReviewsEn,
  ...admSystemEn,
  // Partner
  ...ptSharedEn,
  ...ptDashEn,
  ...ptHotelsEn,
  ...ptRoomsEn,
  ...ptBookingsEn,
  ...ptCalendarEn,
  ...ptRevenueEn,
  ...ptReviewsEn,
  ...ptForecastEn,
};
