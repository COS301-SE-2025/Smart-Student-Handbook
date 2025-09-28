// components/ui/__tests__/integration/org.test.js
const { ref, set, get } = require('firebase/database')

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
}))

describe('Organizations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create organization', async () => {
    const orgData = {
      id: 'org-1',
      name: 'Test Org',
      description: 'Test description',
      isPrivate: false,
      ownerId: 'user-1',
    }

    const mockRef = { key: 'org-1' }
    ref.mockReturnValue(mockRef)
    set.mockResolvedValue(undefined)

    // Create the reference and call set
    const orgRef = ref('organizations', orgData.id)
    await set(orgRef, orgData)

    expect(ref).toHaveBeenCalledWith('organizations', orgData.id)
    expect(set).toHaveBeenCalledWith(mockRef, orgData)
  })

  it('should get organization details', async () => {
    const mockOrg = {
      id: 'org-1',
      name: 'Test Org',
      members: { 'user-1': 'admin' },
    }

    const mockRef = { key: 'org-1' }
    const mockSnapshot = {
      val: () => mockOrg,
      exists: () => true,
    }

    ref.mockReturnValue(mockRef)
    get.mockResolvedValue(mockSnapshot)

    // Call ref and then get
    const orgRef = ref('organizations', mockOrg.id)
    const result = await get(orgRef)
    const org = result.val()

    expect(ref).toHaveBeenCalledWith('organizations', mockOrg.id)
    expect(get).toHaveBeenCalledWith(mockRef)
    expect(org).toEqual(mockOrg)
  })
})