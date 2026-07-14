export const CMS_SNF_DATASET_ID = '4pq5-n9py' // "Provider Information" (Nursing Home Compare)
export const CMS_HOSPITAL_DATASET_ID = 'xubh-q36u' // "Hospital General Information"

export const CMS_METASTORE_ITEM_URL = (id: string) =>
  `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${id}?show-reference-ids=false`

export const CMS_DATASTORE_QUERY_URL = (id: string) =>
  `https://data.cms.gov/provider-data/api/1/datastore/query/${id}/0`

export const CMS_DATA_API_DATASET_URL = (uuid: string) =>
  `https://data.cms.gov/data-api/v1/dataset/${uuid}/data`

/**
 * "Provider of Services File - Hospital & Non-Hospital Facilities" — confirmed directly
 * from https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities
 * (its "API" tab). This dataset isn't discoverable by title search through either the
 * Provider Data Catalog metastore or the general data.json catalog — confirmed by
 * scanning both live and finding zero titles mentioning "provider of services" — so the
 * UUID has to be hardcoded rather than looked up dynamically.
 */
export const CMS_POS_HOSPITAL_DATASET_UUID = '8ba0f9b4-9493-4aa0-9f82-44ea9468d1b5'

export const CENSUS_GEOCODE_SINGLE_URL = (addr: string) =>
  `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
    addr
  )}&benchmark=Public_AR_Current&format=json`

export const CENSUS_GEOCODE_BATCH_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
