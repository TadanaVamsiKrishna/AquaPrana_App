export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

const ANDHRA_PRADESH_DISTRICTS = [
  "Alluri Sitharama Raju",
  "Anakapalli",
  "Annamayya",
  "Ananthapuramu",
  "Bapatla",
  "Chittoor",
  "Dr. B.R. Ambedkar Konaseema",
  "East Godavari",
  "Eluru",
  "Guntur",
  "Kakinada",
  "Krishna",
  "Kurnool",
  "Nandyal",
  "NTR",
  "Palnadu",
  "Parvathipuram Manyam",
  "Prakasam",
  "Sri Potti Sriramulu Nellore",
  "Sri Sathya Sai",
  "Srikakulam",
  "Tirupati",
  "Visakhapatnam",
  "Vizianagaram",
  "West Godavari",
  "YSR Kadapa",
];

const TELANGANA_DISTRICTS = [
  "Adilabad",
  "Bhadradri Kothagudem",
  "Hanamkonda",
  "Hyderabad",
  "Jagtial",
  "Jangaon",
  "Jayashankar Bhupalpally",
  "Jogulamba Gadwal",
  "Kamareddy",
  "Karimnagar",
  "Khammam",
  "Kumuram Bheem",
  "Mahabubabad",
  "Mahabubnagar",
  "Mancherial",
  "Medak",
  "Medchal–Malkajgiri",
  "Mulugu",
  "Nagarkurnool",
  "Nalgonda",
  "Narayanpet",
  "Nirmal",
  "Nizamabad",
  "Peddapalli",
  "Rajanna Sircilla",
  "Rangareddy",
  "Sangareddy",
  "Siddipet",
  "Suryapet",
  "Vikarabad",
  "Wanaparthy",
  "Warangal",
  "Yadadri Bhuvanagiri",
];

const TAMIL_NADU_DISTRICTS = [
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Kanchipuram",
  "Madurai",
  "Nagapattinam",
  "Ramanathapuram",
  "Thanjavur",
  "Tirunelveli",
  "Tiruvallur",
  "Vellore",
];

const KARNATAKA_DISTRICTS = [
  "Bengaluru Urban",
  "Belagavi",
  "Dakshina Kannada",
  "Hassan",
  "Mysuru",
  "Shivamogga",
  "Tumakuru",
  "Udupi",
  "Uttara Kannada",
];

const KERALA_DISTRICTS = [
  "Alappuzha",
  "Ernakulam",
  "Kollam",
  "Kottayam",
  "Kozhikode",
  "Thrissur",
  "Thiruvananthapuram",
];

const ODISHA_DISTRICTS = [
  "Balasore",
  "Bhadrak",
  "Cuttack",
  "Ganjam",
  "Jagatsinghpur",
  "Kendrapara",
  "Khordha",
  "Puri",
];

const WEST_BENGAL_DISTRICTS = [
  "Howrah",
  "Kolkata",
  "Nadia",
  "North 24 Parganas",
  "Paschim Medinipur",
  "Purba Medinipur",
  "South 24 Parganas",
];

const GUJARAT_DISTRICTS = [
  "Ahmedabad",
  "Bharuch",
  "Jamnagar",
  "Junagadh",
  "Navsari",
  "Surat",
  "Vadodara",
];

const MAHARASHTRA_DISTRICTS = [
  "Mumbai",
  "Nagpur",
  "Nashik",
  "Pune",
  "Raigad",
  "Ratnagiri",
  "Sindhudurg",
  "Thane",
];

/** District lists keyed by state. Unknown states fall back to an empty list. */
export const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ANDHRA_PRADESH_DISTRICTS,
  Telangana: TELANGANA_DISTRICTS,
  "Tamil Nadu": TAMIL_NADU_DISTRICTS,
  Karnataka: KARNATAKA_DISTRICTS,
  Kerala: KERALA_DISTRICTS,
  Odisha: ODISHA_DISTRICTS,
  "West Bengal": WEST_BENGAL_DISTRICTS,
  Gujarat: GUJARAT_DISTRICTS,
  Maharashtra: MAHARASHTRA_DISTRICTS,
};

export function getDistrictsForState(state: string): string[] {
  if (!state.trim()) {
    return [];
  }

  const districts = DISTRICTS_BY_STATE[state];
  if (districts && districts.length > 0) {
    return districts;
  }

  return ["Other"];
}

export const PROFILE_LANGUAGE_OPTIONS = [
  "Telugu",
  "Hindi",
  "English",
] as const;

export type ProfileLanguage = (typeof PROFILE_LANGUAGE_OPTIONS)[number];
