export const CMS_SNF_DATASET_ID = '4pq5-n9py' // "Provider Information" (Nursing Home Compare)
export const CMS_HOSPITAL_DATASET_ID = 'xubh-q36u' // "Hospital General Information"

export const CMS_METASTORE_ITEM_URL = (id: string) =>
  `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${id}?show-reference-ids=false`

export const CMS_DATASTORE_QUERY_URL = (id: string) =>
  `https://data.cms.gov/provider-data/api/1/datastore/query/${id}/0`

export const CMS_DATA_JSON_URL = 'https://data.cms.gov/data.json'
export const CMS_DATA_API_DATASET_URL = (uuid: string) =>
  `https://data.cms.gov/data-api/v1/dataset/${uuid}/data`

export const CENSUS_GEOCODE_SINGLE_URL = (addr: string) =>
  `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
    addr
  )}&benchmark=Public_AR_Current&format=json`

export const CENSUS_GEOCODE_BATCH_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

export const HHS_CAPACITY_SOCRATA_ID = 'anag-cw7u'
export const HHS_CAPACITY_URL = (soql: string) =>
  `https://healthdata.gov/resource/${HHS_CAPACITY_SOCRATA_ID}.json?${soql}`

export const HHS_SENTINEL_SUPPRESSED = -999999
