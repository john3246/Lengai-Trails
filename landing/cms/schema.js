// Every CMS resource is a real PostgreSQL table (cms_<name>) with one typed column per field.
// This file is the single source of truth: it drives the table definitions, validation, the admin forms and the public API.
//
// field types: text, textarea, md (long text with the formatting editor), number, date, select, image, email, tour
//   g: where the field sits in the editor ('main' | 'side' | 'seo'); req: required; o: options; auto: reference prefix; max: length limit
// lists: ordered child rows in cms_list_items (two columns a / b), e.g. wildlife = animal + how often
// attach: the record can have files and photos attached (cms_attachments)
// preview: public page template used to preview a draft before publishing
const draftPub = ['draft', 'published'];
const S = {
  tours: { table: 'cms_tours', label: 'Tours', single: 'Tour', title: 'title', attach: true, preview: 'package', publicStatus: 'published', statuses: draftPub, special: 'tour' },

  destinations: { label: 'Destinations', single: 'Destination', title: 'name', slug: 'name', attach: true, preview: 'destination', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'summary', l: 'Short summary (shown on cards)', t: 'textarea', max: 400, g: 'main' },
    { k: 'description', l: 'Overview', t: 'md', g: 'main' }, { k: 'getting_there', l: 'Getting there', t: 'md', g: 'main' },
    { k: 'slug', l: 'URL slug', t: 'text', g: 'side' }, { k: 'region', l: 'Region', t: 'select', o: ['Northern Tanzania', 'Southern Tanzania', 'The Coast', 'Mountains'], g: 'side' },
    { k: 'keyword', l: 'Keyword that finds related packages', t: 'text', g: 'side' },
    { k: 'best_time', l: 'Best time to visit', t: 'text', g: 'side' }, { k: 'high_season', l: 'High season', t: 'text', g: 'side' }, { k: 'best_weather', l: 'Weather', t: 'text', g: 'side' },
    { k: 'image', l: 'Cover image', t: 'image', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' }],
    lists: [{ k: 'highlights', l: 'Highlights', a: 'Title', b: 'Description' }, { k: 'activities', l: 'Things to do', a: 'Activity' }, { k: 'wildlife', l: 'Wildlife you may see', a: 'Animal', b: 'How often' }, { k: 'tips', l: 'Travel tips', a: 'Tip' }] },

  accommodations: { label: 'Accommodations', single: 'Accommodation', title: 'name', slug: 'name', attach: true, preview: 'accommodation', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'description', l: 'Description', t: 'md', g: 'main' },
    { k: 'slug', l: 'URL slug', t: 'text', g: 'side' }, { k: 'location', l: 'Location', t: 'text', g: 'side' },
    { k: 'category', l: 'Category', t: 'select', o: ['Lodge', 'Tented camp', 'Camp', 'Hotel', 'Beach resort'], g: 'side' }, { k: 'stars', l: 'Rating (1-5)', t: 'number', g: 'side' },
    { k: 'image', l: 'Cover image', t: 'image', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' }] },

  blog: { label: 'Blog', single: 'Post', title: 'title', slug: 'title', attach: true, preview: 'post', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'title', l: 'Title', t: 'text', req: 1, g: 'main' }, { k: 'excerpt', l: 'Excerpt (shown on cards and in search results)', t: 'textarea', max: 400, g: 'main' }, { k: 'body', l: 'Article', t: 'md', g: 'main' },
    { k: 'slug', l: 'URL slug', t: 'text', g: 'side' }, { k: 'author', l: 'Author', t: 'text', g: 'side' }, { k: 'published_at', l: 'Publish date', t: 'date', g: 'side' },
    { k: 'image', l: 'Cover image', t: 'image', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' },
    { k: 'seo_title', l: 'SEO title', t: 'text', max: 120, g: 'seo' }, { k: 'seo_description', l: 'SEO description', t: 'textarea', max: 300, g: 'seo' }] },

  faqs: { label: 'FAQs', single: 'FAQ', title: 'question', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'question', l: 'Question', t: 'text', req: 1, g: 'main' }, { k: 'answer', l: 'Answer', t: 'md', g: 'main' },
    { k: 'category', l: 'Category', t: 'select', o: ['General', 'Safari', 'Kilimanjaro', 'Booking & payment', 'Travel & visas'], g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' }] },

  reviews: { label: 'Guest reviews', single: 'Review', title: 'name', publicStatus: 'published', statuses: ['pending', 'published', 'hidden'], fields: [
    { k: 'name', l: 'Guest name', t: 'text', req: 1, g: 'main' }, { k: 'headline', l: 'Headline', t: 'text', g: 'main' }, { k: 'text', l: 'Review', t: 'textarea', max: 3000, g: 'main' },
    { k: 'country', l: 'Country', t: 'text', g: 'side' }, { k: 'rating', l: 'Rating (1-5)', t: 'number', g: 'side' }, { k: 'tour', l: 'Trip', t: 'text', g: 'side' },
    { k: 'date', l: 'Date', t: 'date', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: ['pending', 'published', 'hidden'], g: 'side' }] },

  testimonials: { label: 'Testimonials', single: 'Testimonial', title: 'name', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'quote', l: 'Quote', t: 'textarea', max: 1500, g: 'main' },
    { k: 'role', l: 'Role / origin', t: 'text', g: 'side' }, { k: 'image', l: 'Photo', t: 'image', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' }] },

  offers: { label: 'Holiday offers', single: 'Offer', title: 'title', publicStatus: 'published', statuses: draftPub, fields: [
    { k: 'title', l: 'Title', t: 'text', req: 1, g: 'main' }, { k: 'description', l: 'Description', t: 'textarea', g: 'main' }, { k: 'child_note', l: 'Child price note', t: 'text', g: 'main' },
    { k: 'tour', l: 'Linked package', t: 'tour', g: 'side' }, { k: 'discount', l: 'Saving already in the package price (USD per person)', t: 'number', g: 'side' },
    { k: 'label', l: 'Small label (e.g. 5 days · Christmas)', t: 'text', g: 'side' }, { k: 'image', l: 'Image (blank = package image)', t: 'image', g: 'side' },
    { k: 'valid_until', l: 'Valid until', t: 'date', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: draftPub, g: 'side' }] },

  group: { label: 'Group Safari', single: 'Departure', title: 'tour', publicStatus: 'open', statuses: ['open', 'full', 'cancelled'], fields: [
    { k: 'tour', l: 'Package', t: 'tour', req: 1, g: 'main' }, { k: 'departure_date', l: 'Departure date', t: 'date', req: 1, g: 'main' },
    { k: 'seats_total', l: 'Total seats', t: 'number', g: 'main' }, { k: 'seats_left', l: 'Seats left', t: 'number', g: 'main' }, { k: 'price_usd', l: 'Price per person (USD)', t: 'number', g: 'main' },
    { k: 'status', l: 'Status', t: 'select', o: ['open', 'full', 'cancelled'], g: 'side' }] },

  bookings: { label: 'Bookings', single: 'Booking', title: 'reference', ops: true, statuses: ['New', 'Confirmed', 'Paid', 'Completed', 'Cancelled'], fields: [
    { k: 'reference', l: 'Reference', t: 'text', auto: 'BK', g: 'side' }, { k: 'customer', l: 'Customer', t: 'text', req: 1, g: 'main' }, { k: 'email', l: 'Email', t: 'email', g: 'main' },
    { k: 'phone', l: 'Phone / WhatsApp', t: 'text', g: 'main' }, { k: 'country', l: 'Country', t: 'text', g: 'main' },
    { k: 'tour', l: 'Package', t: 'tour', g: 'main' }, { k: 'tour_slug', l: 'Package slug', t: 'text', g: 'side' }, { k: 'start_date', l: 'Start date', t: 'date', g: 'main' }, { k: 'travelers', l: 'Travelers', t: 'number', g: 'main' },
    { k: 'total_usd', l: 'Total (USD)', t: 'number', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Confirmed', 'Paid', 'Completed', 'Cancelled'], g: 'side' }, { k: 'notes', l: 'Notes', t: 'textarea', max: 5000, g: 'main' }] },

  inquiries: { label: 'Inquiries', single: 'Inquiry', title: 'name', ops: true, statuses: ['New', 'Replied', 'Quoted', 'Closed'], fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'email', l: 'Email', t: 'email', g: 'main' }, { k: 'phone', l: 'Phone', t: 'text', g: 'main' }, { k: 'country', l: 'Country', t: 'text', g: 'main' },
    { k: 'interest', l: 'Interest', t: 'text', g: 'main' }, { k: 'dates', l: 'Travel dates', t: 'text', g: 'main' }, { k: 'travelers', l: 'Travelers', t: 'text', g: 'main' },
    { k: 'message', l: 'Message', t: 'textarea', max: 5000, g: 'main' }, { k: 'source', l: 'Source', t: 'text', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Replied', 'Quoted', 'Closed'], g: 'side' }] },

  customers: { label: 'Customers', single: 'Customer', title: 'name', ops: true, fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'email', l: 'Email', t: 'email', g: 'main' }, { k: 'phone', l: 'Phone', t: 'text', g: 'main' }, { k: 'country', l: 'Country', t: 'text', g: 'main' },
    { k: 'trips', l: 'Trips taken', t: 'number', g: 'side' }, { k: 'notes', l: 'Notes', t: 'textarea', max: 5000, g: 'main' }] },

  invoices: { label: 'Invoices', single: 'Invoice', title: 'number', ops: true, statuses: ['Draft', 'Sent', 'Paid', 'Overdue'], fields: [
    { k: 'number', l: 'Invoice number', t: 'text', auto: 'INV', g: 'side' }, { k: 'customer', l: 'Customer', t: 'text', req: 1, g: 'main' }, { k: 'booking', l: 'Booking reference', t: 'text', g: 'main' },
    { k: 'amount_usd', l: 'Amount (USD)', t: 'number', req: 1, g: 'main' }, { k: 'issued', l: 'Issued', t: 'date', g: 'side' }, { k: 'due', l: 'Due', t: 'date', g: 'side' },
    { k: 'status', l: 'Status', t: 'select', o: ['Draft', 'Sent', 'Paid', 'Overdue'], g: 'side' }, { k: 'notes', l: 'Notes', t: 'textarea', max: 5000, g: 'main' }] },

  clients: { label: 'Client records', single: 'Client', title: 'name', ops: true, statuses: ['lead', 'active', 'past'], fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'email', l: 'Email', t: 'email', g: 'main' }, { k: 'phone', l: 'Phone', t: 'text', g: 'main' }, { k: 'country', l: 'Country', t: 'text', g: 'main' },
    { k: 'preferences', l: 'Preferences', t: 'textarea', max: 5000, g: 'main' }, { k: 'notes', l: 'Notes', t: 'textarea', max: 5000, g: 'main' }, { k: 'status', l: 'Status', t: 'select', o: ['lead', 'active', 'past'], g: 'side' }] },

  tasks: { label: 'Tasks & notes', single: 'Task', title: 'title', ops: true, statuses: ['todo', 'doing', 'done'], fields: [
    { k: 'title', l: 'Task', t: 'text', req: 1, g: 'main' }, { k: 'notes', l: 'Notes', t: 'textarea', max: 5000, g: 'main' },
    { k: 'assignee', l: 'Assigned to', t: 'text', g: 'side' }, { k: 'due', l: 'Due date', t: 'date', g: 'side' }, { k: 'status', l: 'Status', t: 'select', o: ['todo', 'doing', 'done'], g: 'side' }] },

  integrations: { label: 'Integrations & webhooks', single: 'Integration', title: 'name', admin: true, fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1, g: 'main' }, { k: 'url', l: 'URL / endpoint (https only)', t: 'text', g: 'main' },
    { k: 'type', l: 'Type', t: 'select', o: ['Webhook', 'Email', 'Analytics', 'Payments', 'Other'], g: 'side' }, { k: 'event', l: 'Trigger event', t: 'select', o: ['New inquiry', 'New booking', 'Booking paid', 'Any'], g: 'side' },
    { k: 'active', l: 'State', t: 'select', o: ['active', 'paused'], g: 'side' }] }
};
for (const [k, r] of Object.entries(S)) { r.key = k; r.table = r.table || 'cms_' + k; r.fields = r.fields || []; r.lists = r.lists || []; r.statuses = r.statuses || null; }
module.exports = S;
