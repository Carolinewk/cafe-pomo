// The menu. `earn` is the coins a 25-minute focus session pays while serving this drink;
// `price` is what it costs in the shop. `cup` colors the tiny pixel cup in the cafe:
// [cup, cup shade, drink on top].

export const COFFEES = [
  {
    id: 'espresso',
    name: 'Espresso',
    price: 0,
    earn: 5,
    note: 'Curto, intenso e honesto. Todo café começa aqui.',
    cup: ['#fffaf3', '#d8cfc6', '#8a5129'],
  },
  {
    id: 'doppio',
    name: 'Espresso Duplo',
    price: 15,
    earn: 7,
    note: 'Duas doses para quem tem muito a fazer.',
    cup: ['#e3eef0', '#b9cdd2', '#4a2817'],
  },
  {
    id: 'macchiato',
    name: 'Macchiato',
    price: 35,
    earn: 9,
    note: 'Espresso com uma nuvem de espuma por cima.',
    cup: ['#c4d8b6', '#8fae82', '#fffaf2'],
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    price: 60,
    earn: 12,
    note: 'Espuma macia, cacau e um coração desenhado.',
    cup: ['#d3e0ee', '#9fb3cc', '#d8ad7f'],
  },
  {
    id: 'latte',
    name: 'Latte',
    price: 90,
    earn: 15,
    note: 'Leite vaporizado em camadas, sem pressa.',
    cup: ['#f1e6d6', '#cdb9a5', '#fffaf2'],
  },
  {
    id: 'mocha',
    name: 'Mocha',
    price: 130,
    earn: 18,
    note: 'Chocolate, café e uma montanha de chantilly.',
    cup: ['#b4c8dc', '#7f98b4', '#fffaf3'],
  },
  {
    id: 'iced_latte',
    name: 'Latte Gelado',
    price: 180,
    earn: 22,
    note: 'Gelo tilintando e café descendo pelo leite.',
    cup: ['#e7d6c3', '#b98a64', '#dff0f5'],
  },
  {
    id: 'matcha_frappe',
    name: 'Frappé de Matcha',
    price: 240,
    earn: 26,
    note: 'Verdinho, gelado e com chantilly na tampa.',
    cup: ['#a7c97a', '#6e9a49', '#fffaf3'],
  },
  {
    id: 'caramel_frappe',
    name: 'Frappé de Caramelo',
    price: 310,
    earn: 30,
    note: 'Caramelo escorrendo por todo lado.',
    cup: ['#d9a46a', '#a8692f', '#fffaf3'],
  },
  {
    id: 'affogato',
    name: 'Affogato',
    price: 390,
    earn: 35,
    note: 'Sorvete de baunilha afogado em espresso.',
    cup: ['#eef3f3', '#c3d0d0', '#fff5df'],
  },
  {
    id: 'lavender_latte',
    name: 'Latte de Lavanda',
    price: 480,
    earn: 40,
    note: 'Floral, delicado e levemente lilás.',
    cup: ['#d9cdea', '#a897c4', '#efe4f2'],
  },
  {
    id: 'strawberry_matcha',
    name: 'Matcha de Morango',
    price: 600,
    earn: 46,
    note: 'Morango, leite e matcha. A estrela da casa.',
    cup: ['#f2a4ae', '#d98290', '#a9c97c'],
  },
];

export const COFFEE_BY_ID = Object.fromEntries(COFFEES.map((c) => [c.id, c]));

export const STARTER = 'espresso';
