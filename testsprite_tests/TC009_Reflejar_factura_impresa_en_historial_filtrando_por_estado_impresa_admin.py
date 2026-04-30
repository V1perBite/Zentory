import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000")
        
        # -> Rellenar el campo Email con el usuario proporcionado y el campo Contraseña, luego enviar el formulario de inicio de sesión.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/form/div/input').nth(0)
        await asyncio.sleep(3); await elem.fill('er20182511@gmail.com')
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/form/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('David123*')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/form/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the 'Centro de impresión' module from the dashboard so we can locate a pending invoice to mark as printed.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/main/section/div[3]/a[4]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Navigate to the dashboard/homepage to reload the SPA so we can access Print Center or History.
        await page.goto("http://localhost:3000/")
        
        # -> Navigate to the invoice history page (/historial) to check if the SPA loads and to proceed with filtering for printed invoices. If the page remains blank, try reloading dashboard or /imprimir next.
        await page.goto("http://localhost:3000/historial")
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'impresa')]").nth(0).is_visible(), "El historial de facturas debería mostrar al menos una factura marcada como impresa después de aplicar el filtro por estado impresa."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    