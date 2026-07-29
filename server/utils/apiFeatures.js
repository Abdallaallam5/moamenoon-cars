/**
 * utils/apiFeatures.js
 * -----------------------------------------------------------------------
 * A small chainable helper that turns query-string parameters into a
 * Mongoose query: filtering, keyword search, sorting, field selection,
 * and pagination. Used mainly by GET /api/vehicles.
 *
 * Supported query params (all optional):
 *   keyword, category, brand, condition, fuel, transmission,
 *   priceMin, priceMax, yearMin, yearMax, mileageMax, city, country,
 *   sort, page, limit, fields
 * -----------------------------------------------------------------------
 */

class ApiFeatures {
  constructor(mongooseQuery, queryString) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
  }

  // ---------------- Keyword search (title, description, model) ----------------
  search() {
    if (this.queryString.keyword) {
      this.mongooseQuery = this.mongooseQuery.find({
        $text: { $search: this.queryString.keyword },
      });
    }
    return this;
  }

  // ---------------- Structured filters ----------------
  filter() {
    const filters = {};
    const {
      category,
      brand,
      condition,
      fuel,
      transmission,
      priceMin,
      priceMax,
      yearMin,
      yearMax,
      mileageMax,
      city,
      country,
      status,
    } = this.queryString;

    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (condition) filters.condition = condition;
    if (fuel) filters.fuel = fuel;
    if (transmission) filters.transmission = transmission;
    if (status && status !== 'any') {
  filters.status = status;
}
    if (priceMin || priceMax) {
      filters.price = {};
      if (priceMin) filters.price.$gte = Number(priceMin);
      if (priceMax) filters.price.$lte = Number(priceMax);
    }

    if (yearMin || yearMax) {
      filters.year = {};
      if (yearMin) filters.year.$gte = Number(yearMin);
      if (yearMax) filters.year.$lte = Number(yearMax);
    }

    if (mileageMax) {
      filters.mileage = { $lte: Number(mileageMax) };
    }

    if (city) filters['location.city'] = new RegExp(city, 'i');
    if (country) filters['location.country'] = new RegExp(country, 'i');

    this.mongooseQuery = this.mongooseQuery.find(filters);
    return this;
  }

  // ---------------- Sorting ----------------
  sort() {
    if (this.queryString.sort) {
      // e.g. sort=-price,year  ->  "-price year"
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort('-createdAt'); // newest first by default
    }
    return this;
  }

  // ---------------- Field selection (projection) ----------------
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select('-__v');
    }
    return this;
  }

  // ---------------- Pagination ----------------
  paginate() {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 12;
    const skip = (page - 1) * limit;

    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
    this.pagination = { page, limit, skip };
    return this;
  }
}

module.exports = ApiFeatures;
