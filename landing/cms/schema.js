// Field definitions for every generic CMS resource. The admin UI is driven from this.
// types: text, textarea, number, date, select, image, email, bool, tour (select of tours)
const status = ['published', 'draft'];
module.exports = {
  accommodations: { label: 'Accommodations', single: 'Accommodation', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug (auto)', t: 'text' }, { k: 'location', l: 'Location', t: 'text' },
    { k: 'category', l: 'Category', t: 'select', o: ['Lodge', 'Tented camp', 'Camp', 'Hotel', 'Beach resort'] },
    { k: 'stars', l: 'Rating (1-5)', t: 'number' }, { k: 'description', l: 'Description', t: 'textarea' },
    { k: 'image', l: 'Image', t: 'image' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  destinations: { label: 'Destinations', single: 'Destination', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug (auto)', t: 'text' }, { k: 'region', l: 'Region', t: 'select', o: ['Northern Tanzania', 'Southern Tanzania', 'The Coast', 'Mountains'] },
    { k: 'keyword', l: 'Keyword to find related packages', t: 'text' },
    { k: 'summary', l: 'Short summary', t: 'textarea' }, { k: 'description', l: 'Full description', t: 'textarea' },
    { k: 'best_time', l: 'Best time to visit', t: 'text' }, { k: 'high_season', l: 'High season', t: 'text' }, { k: 'best_weather', l: 'Best weather', t: 'text' },
    { k: 'wildlife', l: 'Wildlife (one per line, e.g. Lion: Common)', t: 'textarea' },
    { k: 'image', l: 'Image', t: 'image' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  blog: { label: 'Blog', single: 'Post', title: 'title', fields: [
    { k: 'title', l: 'Title', t: 'text', req: 1 }, { k: 'slug', l: 'Slug', t: 'text' }, { k: 'author', l: 'Author', t: 'text' },
    { k: 'excerpt', l: 'Excerpt', t: 'textarea' }, { k: 'body', l: 'Body', t: 'textarea', big: 1 },
    { k: 'image', l: 'Cover image', t: 'image' }, { k: 'published_at', l: 'Publish date', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  pages: { label: 'Pages', single: 'Page', title: 'title', fields: [
    { k: 'title', l: 'Title', t: 'text', req: 1 }, { k: 'slug', l: 'Slug', t: 'text' }, { k: 'body', l: 'Content', t: 'textarea', big: 1 },
    { k: 'seo_title', l: 'SEO title', t: 'text' }, { k: 'seo_description', l: 'SEO description', t: 'textarea' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  reviews: { label: 'Guest reviews', single: 'Review', title: 'name', fields: [
    { k: 'name', l: 'Guest name', t: 'text', req: 1 }, { k: 'headline', l: 'Headline', t: 'text' }, { k: 'country', l: 'Country', t: 'text' }, { k: 'rating', l: 'Rating (1-5)', t: 'number' },
    { k: 'tour', l: 'Trip', t: 'text' }, { k: 'text', l: 'Review', t: 'textarea' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: ['pending', 'published', 'hidden'] }] },
  testimonials: { label: 'Testimonials', single: 'Testimonial', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'role', l: 'Role / origin', t: 'text' }, { k: 'quote', l: 'Quote', t: 'textarea' },
    { k: 'image', l: 'Photo', t: 'image' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  offers: { label: 'Holiday offers', single: 'Offer', title: 'title', fields: [
    { k: 'title', l: 'Title', t: 'text', req: 1 }, { k: 'tour', l: 'Linked package', t: 'tour' }, { k: 'discount', l: 'Discount (USD per person)', t: 'number' },
    { k: 'valid_until', l: 'Valid until', t: 'date' }, { k: 'description', l: 'Description', t: 'textarea' }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  faqs: { label: 'FAQs', single: 'FAQ', title: 'question', fields: [
    { k: 'question', l: 'Question', t: 'text', req: 1 }, { k: 'answer', l: 'Answer', t: 'textarea', big: 1 },
    { k: 'category', l: 'Category', t: 'select', o: ['General', 'Safari', 'Kilimanjaro', 'Booking & payment', 'Travel & visas'] }, { k: 'status', l: 'Status', t: 'select', o: status }] },
  group: { label: 'Group Safari', single: 'Departure', title: 'tour', fields: [
    { k: 'tour', l: 'Package', t: 'tour', req: 1 }, { k: 'departure_date', l: 'Departure date', t: 'date', req: 1 }, { k: 'seats_total', l: 'Total seats', t: 'number' },
    { k: 'seats_left', l: 'Seats left', t: 'number' }, { k: 'price_usd', l: 'Price per person (USD)', t: 'number' }, { k: 'status', l: 'Status', t: 'select', o: ['open', 'full', 'cancelled'] }] },
  menus: { label: 'Menus', single: 'Menu item', title: 'label', fields: [
    { k: 'label', l: 'Label', t: 'text', req: 1 }, { k: 'url', l: 'Link', t: 'text' }, { k: 'parent', l: 'Parent item', t: 'text' },
    { k: 'position', l: 'Position', t: 'number' }, { k: 'location', l: 'Location', t: 'select', o: ['Main menu', 'Top bar', 'Footer'] }] },
  tasks: { label: 'Tasks & notes', single: 'Task', title: 'title', fields: [
    { k: 'title', l: 'Task', t: 'text', req: 1 }, { k: 'notes', l: 'Notes', t: 'textarea' }, { k: 'assignee', l: 'Assigned to', t: 'text' },
    { k: 'due', l: 'Due date', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: ['todo', 'doing', 'done'] }] },
  clients: { label: 'Client records', single: 'Client', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'email', l: 'Email', t: 'email' }, { k: 'phone', l: 'Phone', t: 'text' }, { k: 'country', l: 'Country', t: 'text' },
    { k: 'preferences', l: 'Preferences', t: 'textarea' }, { k: 'notes', l: 'Notes', t: 'textarea' }, { k: 'status', l: 'Status', t: 'select', o: ['lead', 'active', 'past'] }] },
  bookings: { label: 'Bookings', single: 'Booking', title: 'reference', fields: [
    { k: 'reference', l: 'Reference', t: 'text', auto: 'BK' }, { k: 'customer', l: 'Customer', t: 'text', req: 1 }, { k: 'email', l: 'Email', t: 'email' },
    { k: 'phone', l: 'Phone / WhatsApp', t: 'text' }, { k: 'country', l: 'Country', t: 'text' },
    { k: 'tour', l: 'Package', t: 'tour' }, { k: 'tour_slug', l: 'Package slug', t: 'text' }, { k: 'start_date', l: 'Start date', t: 'date' }, { k: 'travelers', l: 'Travelers', t: 'number' },
    { k: 'total_usd', l: 'Total (USD)', t: 'number' }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Confirmed', 'Paid', 'Completed', 'Cancelled'] }, { k: 'notes', l: 'Notes', t: 'textarea' }] },
  inquiries: { label: 'Inquiries', single: 'Inquiry', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'email', l: 'Email', t: 'email' }, { k: 'phone', l: 'Phone', t: 'text' }, { k: 'country', l: 'Country', t: 'text' },
    { k: 'interest', l: 'Interest', t: 'text' }, { k: 'dates', l: 'Travel dates', t: 'text' }, { k: 'travelers', l: 'Travelers', t: 'text' },
    { k: 'message', l: 'Message', t: 'textarea' }, { k: 'source', l: 'Source', t: 'text' }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Replied', 'Quoted', 'Closed'] }] },
  customers: { label: 'Customers', single: 'Customer', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'email', l: 'Email', t: 'email' }, { k: 'phone', l: 'Phone', t: 'text' }, { k: 'country', l: 'Country', t: 'text' },
    { k: 'trips', l: 'Trips taken', t: 'number' }, { k: 'notes', l: 'Notes', t: 'textarea' }] },
  invoices: { label: 'Invoices', single: 'Invoice', title: 'number', fields: [
    { k: 'number', l: 'Invoice number', t: 'text', auto: 'INV' }, { k: 'customer', l: 'Customer', t: 'text', req: 1 }, { k: 'booking', l: 'Booking reference', t: 'text' },
    { k: 'amount_usd', l: 'Amount (USD)', t: 'number', req: 1 }, { k: 'issued', l: 'Issued', t: 'date' }, { k: 'due', l: 'Due', t: 'date' },
    { k: 'status', l: 'Status', t: 'select', o: ['Draft', 'Sent', 'Paid', 'Overdue'] }, { k: 'notes', l: 'Notes', t: 'textarea' }] },
  integrations: { label: 'Integrations & webhooks', single: 'Integration', title: 'name', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'type', l: 'Type', t: 'select', o: ['Webhook', 'Email', 'Analytics', 'Payments', 'Other'] },
    { k: 'url', l: 'URL / endpoint', t: 'text' }, { k: 'event', l: 'Trigger event', t: 'select', o: ['New inquiry', 'New booking', 'Booking paid', 'Any'] },
    { k: 'active', l: 'Status', t: 'select', o: ['active', 'paused'] }] }
};
