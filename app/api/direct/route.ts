export async function POST(request: Request) {
  const formData = await request.formData()

  const backendFormData = new FormData()
  for (const [key, value] of formData.entries()) {
    backendFormData.append(key, value as string | File)
  }

  const response = await fetch(
    `${process.env.BACKEND_URL}/microsites/execution/direct`,
    {
      method: "POST",
      headers: {
        "x-api-key": process.env.API_KEY!,
      },
      body: backendFormData,
    }
  )

  const data = await response.json()
  return Response.json(data, { status: response.status })
}
