import { CafPage } from './app.po';

describe('caf App', () => {
  let page: CafPage;

  beforeEach(() => {
    page = new CafPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
