import asyncio
import asyncpg

async def main():
    sys_conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/postgres')
    try:
        await sys_conn.execute('CREATE DATABASE erp_dev')
        print("created erp_dev")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await sys_conn.close()

asyncio.run(main())
